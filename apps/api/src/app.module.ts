import { Module, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { trace } from '@opentelemetry/api';
import { LoggerModule } from 'nestjs-pino';
import { ClientThrottlerGuard } from './common/client-throttler.guard';
import { type Env, validateEnv } from './config/env';
import { HealthModule } from './health/health.module';
import { AssistantModule } from './modules/assistant/assistant.module';
import { InsightsModule } from './modules/insights/insights.module';
import { SellersModule } from './modules/sellers/sellers.module';
import { RecommendationsModule } from './modules/recommendations/recommendations.module';
import { AdvertisingModule } from './modules/advertising/advertising.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { DealsModule } from './modules/deals/deals.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { VisualSearchModule } from './modules/visual-search/visual-search.module';
import { PlusModule } from './modules/plus/plus.module';
import { BundlesModule } from './modules/bundles/bundles.module';
import { ClipCouponsModule } from './modules/clip-coupons/clip-coupons.module';
import { PriceHistoryModule } from './modules/price-history/price-history.module';
import { HelpModule } from './modules/help/help.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { AuditModule } from './modules/audit/audit.module';
import { CartModule } from './modules/cart/cart.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CustomersModule } from './modules/customers/customers.module';
import { DevicesModule } from './modules/devices/devices.module';
import { EngagementModule } from './modules/engagement/engagement.module';
import { AccessTokenGuard } from './modules/identity/guards/access-token.guard';
import { PermissionsGuard } from './modules/identity/guards/permissions.guard';
import { IdentityModule } from './modules/identity/identity.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { MediaModule } from './modules/media/media.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrdersModule } from './modules/orders/orders.module';
import { OutboxModule } from './modules/outbox/outbox.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { ShippingModule } from './modules/shipping/shipping.module';
import { SupportModule } from './modules/support/support.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { DatabaseMaintenanceModule } from './database/database-maintenance.module';
import { KafkaModule } from './kafka/kafka.module';
import { MetricsCollectors } from './metrics/metrics.collectors';
import { MetricsModule } from './metrics/metrics.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        // Express 5 route syntax; avoids the legacy "*" wildcard warning.
        forRoutes: [{ path: '{*splat}', method: RequestMethod.ALL }],
        pinoHttp: {
          level: config.get('LOG_LEVEL', { infer: true }),
          // Puts the trace id on every log line, so logs and traces link up in Grafana/Jaeger.
          mixin: () => {
            const span = trace.getActiveSpan();
            if (!span) return {};
            const { traceId, spanId } = span.spanContext();
            return { trace_id: traceId, span_id: spanId };
          },
          // Never write credentials or session cookies to logs.
          // The web apps send the internal key with every call: it must never reach the logs.
          redact: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["x-internal-key"]',
            'req.headers["stripe-signature"]',
            'res.headers["set-cookie"]',
          ],
          transport:
            config.get('NODE_ENV', { infer: true }) === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
        skipIf: () => !config.get('RATE_LIMIT_ENABLED', { infer: true }),
      }),
    }),
    PrismaModule,
    RedisModule,
    KafkaModule,
    MetricsModule,
    AuditModule,
    AssistantModule,
    RecommendationsModule,
    AdvertisingModule,
    AlertsModule,
    DealsModule,
    SubscriptionsModule,
    MessagingModule,
    VisualSearchModule,
    PlusModule,
    BundlesModule,
    ClipCouponsModule,
    PriceHistoryModule,
    HelpModule,
    ReferralsModule,
    InsightsModule,
    SellersModule,
    NotificationsModule,
    SupportModule,
    OutboxModule,
    DatabaseMaintenanceModule,
    // Feature modules, added phase by phase.
    IdentityModule,
    UsersModule,
    MediaModule,
    CatalogModule,
    InventoryModule,
    CartModule,
    OrdersModule,
    CustomersModule,
    DevicesModule,
    PromotionsModule,
    EngagementModule,
    ShippingModule,
    HealthModule,
  ],
  // Global guards run in this order: rate limit, then authentication, then authorization.
  providers: [
    { provide: APP_GUARD, useClass: ClientThrottlerGuard },
    { provide: APP_GUARD, useClass: AccessTokenGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    MetricsCollectors,
  ],
})
export class AppModule {}
