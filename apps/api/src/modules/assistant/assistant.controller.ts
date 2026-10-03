import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type AssistantChatRequest,
  AssistantChatRequestSchema,
  type AssistantChatResponse,
  AssistantChatResponseSchema,
} from '@nixzora/validation';
import { ApiZodResponse } from '../../common/api-docs';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Public } from '../identity/guards/decorators';
import { AssistantService } from './assistant.service';
import { requestLocale } from './replies';

/** The AI shopping assistant. Public like the catalog; rate limited per client. */
@ApiTags('assistant')
@Public()
@Controller({ path: 'assistant', version: '1' })
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('chat')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiZodResponse(AssistantChatResponseSchema)
  /** Answers in the shopper's language (Accept-Language: en, fr or es; English otherwise). */
  chat(
    @Body(new ZodValidationPipe(AssistantChatRequestSchema)) body: AssistantChatRequest,
    @Headers('accept-language') acceptLanguage?: string,
  ): Promise<AssistantChatResponse> {
    return this.assistant.chat(body, requestLocale(acceptLanguage));
  }
}
