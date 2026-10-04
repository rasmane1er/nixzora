import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import {
  type UploadReady,
  UploadReadySchema,
  type UploadRequest,
  UploadRequestSchema,
  type UploadTicket,
  UploadTicketSchema,
} from '@nixzora/validation';
import { type Response } from 'express';
import { ApiZodBody, ApiZodResponse } from '../../common/api-docs';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Public, RequirePermissions } from '../identity/guards/decorators';
import { CONTENT_TYPE_BY_EXT, isDeclaredType, STORAGE_KEY_PATTERN } from './image-type';
import { MediaIntakeService } from './media-intake.service';
import { StorageService } from './storage.service';

@ApiTags('media')
@Controller({ path: '', version: '1' })
export class MediaController {
  constructor(
    private readonly storage: StorageService,
    private readonly intake: MediaIntakeService,
  ) {}

  /** Step 1 of an image upload: get a short-lived, single-object upload link. */
  @Post('admin/uploads')
  @ApiBearerAuth()
  @RequirePermissions('catalog.write')
  @ApiZodBody(UploadRequestSchema)
  @ApiZodResponse(
    UploadTicketSchema,
    201,
    'PUT the file to uploadUrl with these headers within 5 minutes.',
  )
  createUpload(
    @Body(new ZodValidationPipe(UploadRequestSchema)) body: UploadRequest,
  ): Promise<UploadTicket> {
    return this.storage.createUpload(body.contentType, body.sizeBytes);
  }

  /** Step 2 (local driver only): receive the file. The signed link is the authorization. */
  @Public()
  @Put('media/upload')
  @HttpCode(HttpStatus.CREATED)
  @ApiExcludeEndpoint()
  async upload(
    @Query() query: Record<string, unknown>,
    @Headers('content-type') contentType: string | undefined,
    @Body() body: unknown,
  ): Promise<{ storageKey: string }> {
    if (!this.storage.isLocal) throw new NotFoundException();

    const claims = this.storage.verifyLocalUpload(query);
    if (!claims) throw new ForbiddenException('This upload link is invalid or has expired.');
    if (contentType?.split(';')[0]?.trim() !== claims.contentType) {
      throw new BadRequestException(`Send the file with Content-Type: ${claims.contentType}.`);
    }
    if (!Buffer.isBuffer(body) || body.length === 0)
      throw new BadRequestException('The file is empty.');
    if (body.length > claims.sizeBytes)
      throw new BadRequestException('The file is larger than declared.');
    if (!isDeclaredType(body, claims.contentType)) {
      throw new BadRequestException('The file content does not match its image type.');
    }

    try {
      await this.storage.writeLocalUpload(claims.key, body);
    } catch {
      throw new ForbiddenException('This upload link has already been used.');
    }
    return { storageKey: claims.key };
  }

  /**
   * Step 3 (optional): check and prepare an upload now, to show a preview before the form that
   * uses it is saved. Saving does the same, so most screens skip this.
   */
  @Post('media/ready')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiZodBody(UploadReadySchema)
  async ready(
    @Body(new ZodValidationPipe(UploadReadySchema)) body: UploadReady,
  ): Promise<{ storageKey: string; publicUrl: string }> {
    if (!(await this.intake.ensureReady(body.storageKey))) {
      throw new BadRequestException('Upload the file first.');
    }
    return { storageKey: body.storageKey, publicUrl: this.storage.publicUrl(body.storageKey) };
  }

  /** Serves locally stored images (development). In production CloudFront serves them from S3. */
  @Public()
  @Get('media/products/:year/:month/:file')
  @ApiExcludeEndpoint()
  serve(
    @Param('year') year: string,
    @Param('month') month: string,
    @Param('file') file: string,
    @Res() res: Response,
  ): void {
    const key = `products/${year}/${month}/${file}`;
    if (!this.storage.isLocal || !STORAGE_KEY_PATTERN.test(key)) throw new NotFoundException();

    const ext = file.split('.').pop() ?? '';
    res.setHeader('Content-Type', CONTENT_TYPE_BY_EXT[ext] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.sendFile(key, { root: this.storage.localRoot, dotfiles: 'deny' }, (error) => {
      if (error && !res.headersSent)
        res.status(404).json({ statusCode: 404, message: 'Not found' });
    });
  }
}
