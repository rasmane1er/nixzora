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
import { perMinute } from '../../common/throttle-profiles';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { type AuthUser } from '../identity/auth-user';
import { MaybeUser, OptionalAuth } from '../identity/guards/decorators';
import { RecommendationsService } from '../recommendations/recommendations.service';
import { AssistantService } from './assistant.service';
import { requestLocale } from './replies';

/** The AI shopping assistant. Public like the catalog; rate limited per client. */
@ApiTags('assistant')
@Controller({ path: 'assistant', version: '1' })
export class AssistantController {
  constructor(
    private readonly assistant: AssistantService,
    private readonly recommendations: RecommendationsService,
  ) {}

  @OptionalAuth()
  @Post('chat')
  @HttpCode(200)
  @Throttle(perMinute(20))
  @ApiZodResponse(AssistantChatResponseSchema)
  /** Answers in the shopper's language (Accept-Language: en, fr or es; English otherwise). */
  async chat(
    @Body(new ZodValidationPipe(AssistantChatRequestSchema)) body: AssistantChatRequest,
    @MaybeUser() user: AuthUser | undefined,
    @Headers('accept-language') acceptLanguage?: string,
  ): Promise<AssistantChatResponse> {
    const { visitorId, ...request } = body;
    const response = await this.assistant.chat(request, requestLocale(acceptLanguage));
    // What they asked for, once it found something, shapes their picks (p10-02).
    const wanted = response.need.query.trim() || response.need.categoryName || '';
    if (response.picks.length && wanted) {
      await this.recommendations
        .recordInterest(
          wanted,
          'ASSISTANT',
          { userId: user?.id, visitorId },
          response.need.category,
        )
        .catch(() => undefined);
    }
    return response;
  }
}
