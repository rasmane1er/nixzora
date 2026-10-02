import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { type Response } from 'express';
import { type HealthResponse } from '@nixzora/validation';
import { Public } from '../modules/identity/guards/decorators';
import { HealthService } from './health.service';

@ApiTags('platform')
@Public()
@SkipThrottle()
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOkResponse({ description: 'All dependencies are reachable.' })
  @ApiServiceUnavailableResponse({ description: 'At least one dependency is down.' })
  async get(@Res({ passthrough: true }) res: Response): Promise<HealthResponse> {
    const result = await this.health.check();
    res.status(result.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return result;
  }
}
