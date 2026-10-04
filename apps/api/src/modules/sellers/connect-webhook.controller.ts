import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  type RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { type Request } from 'express';
import { Public } from '../identity/guards/decorators';
import { PAYOUT_GATEWAY, type PayoutGateway } from '../payments/payout-gateway';
import { SellersService } from './sellers.service';

/**
 * Stripe Connect → NIXZORA: a seller's connected account changed (identity verified, bank
 * added, documents requested). The store's payout status updates without anyone pressing
 * "refresh", and the store is emailed when payouts start or need action.
 */
@ApiTags('payments')
@Controller({ path: 'payments/webhooks', version: '1' })
export class ConnectWebhookController {
  constructor(
    @Inject(PAYOUT_GATEWAY) private readonly payouts: PayoutGateway,
    private readonly sellers: SellersService,
  ) {}

  @Post('stripe-connect')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async stripeConnect(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<{ received: true; result: string }> {
    if (this.payouts.name !== 'STRIPE') throw new ForbiddenException('Stripe is not enabled.');
    if (!req.rawBody) throw new BadRequestException('Missing body.');
    const accountId = this.payouts.accountFromWebhook(req.rawBody, signature);
    const result = accountId ? await this.sellers.syncByPayoutAccount(accountId) : 'ignored';
    return { received: true, result };
  }
}
