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
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  type RawBodyRequest,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { type LabelPurchase, LabelPurchaseSchema, type OrderView } from '@nixzora/validation';
import { type Request, type Response } from 'express';
import { ApiZodBody } from '../../common/api-docs';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { PrismaService } from '../../prisma/prisma.service';
import { Actor, type ActorContext } from '../identity/guards/actor.decorator';
import { Public, RequirePermissions } from '../identity/guards/decorators';
import { FakeShippingGateway } from './fake-shipping.gateway';
import { LabelsService } from './labels.service';

const escape = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

@ApiTags('shipping')
@Controller({ version: '1' })
export class ShippingController {
  constructor(
    private readonly labels: LabelsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('admin/orders/:id/label')
  @ApiBearerAuth()
  @RequirePermissions('orders.fulfill')
  @HttpCode(HttpStatus.OK)
  @ApiZodBody(LabelPurchaseSchema)
  buy(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(LabelPurchaseSchema)) body: LabelPurchase,
    @Actor() actor: ActorContext,
  ): Promise<OrderView> {
    return this.labels.buy(id, body, actor);
  }

  @Get('admin/orders/:id/shipping')
  @ApiBearerAuth()
  @RequirePermissions('orders.read.all')
  async shipping(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<{ labelUrl: string | null; postageCents: number | null; provider: string }> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: { labelUrl: true, postageCents: true },
    });
    if (!order) throw new NotFoundException('Order not found.');
    return { ...order, provider: this.labels.gateway.name };
  }

  /** EasyPost → NIXZORA tracking updates (signed). */
  @Post('shipping/webhooks/easypost')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async easypost(
    @Req() req: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ): Promise<{ received: true; result: string }> {
    if (this.labels.gateway.name !== 'EASYPOST')
      throw new ForbiddenException('EasyPost is not enabled.');
    if (!req.rawBody) throw new BadRequestException('Missing body.');
    const event = this.labels.gateway.parseWebhook(req.rawBody, headers);
    return { received: true, result: event ? await this.labels.applyTracking(event) : 'ignored' };
  }

  /** Development only: a printable stand-in for a carrier label. */
  @Get('shipping/test-labels/:reference')
  @Public()
  @ApiExcludeEndpoint()
  async testLabel(
    @Param('reference') reference: string,
    @Query('sig') sig: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const gateway = this.labels.gateway;
    if (!(gateway instanceof FakeShippingGateway) || !sig || gateway.signature(reference) !== sig) {
      throw new NotFoundException();
    }
    const order = await this.prisma.order.findUnique({ where: { number: reference } });
    if (!order) throw new NotFoundException();
    const to = order.shippingAddress as Record<string, string>;
    const from = this.labels.from();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    res.send(`<!doctype html><meta charset="utf-8"><title>Label ${escape(order.number)}</title>
<style>body{font:14px/1.4 system-ui;margin:0;display:grid;place-items:center;min-height:100vh;background:#eee}
.l{width:4in;height:6in;background:#fff;border:2px solid #000;padding:.25in;box-sizing:border-box;display:flex;flex-direction:column;gap:12px}
.t{font:700 22px system-ui;border-bottom:4px solid #000;padding-bottom:6px}.b{margin-top:auto;font:16px monospace;letter-spacing:2px;text-align:center}
.bar{height:60px;background:repeating-linear-gradient(90deg,#000 0 2px,#fff 2px 4px,#000 4px 7px,#fff 7px 9px)}small{color:#555}</style>
<div class="l"><div class="t">TEST LABEL · ${escape(order.trackingCarrier ?? 'USPS')}</div>
<div><small>FROM</small><br>${escape(from.name)}<br>${escape(from.street1)}<br>${escape(from.city)}, ${escape(from.state)} ${escape(from.zip)}</div>
<div style="font-size:18px"><small>SHIP TO</small><br><b>${escape(to.fullName)}</b><br>${escape(to.line1)}${to.line2 ? `<br>${escape(to.line2)}` : ''}<br>${escape(to.city)}, ${escape(to.region)} ${escape(to.postalCode)}</div>
<div><small>ORDER</small> ${escape(order.number)}</div><div class="bar"></div>
<div class="b">${escape(order.trackingNumber ?? '')}</div><small>Not valid for mailing. Development label.</small></div>`);
  }
}
