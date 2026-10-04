import { Global, Module } from '@nestjs/common';
import { MetricsServer } from './metrics.server';

/** Prometheus metrics endpoint (ADR-0023). Imported by every process's root module. */
@Global()
@Module({ providers: [MetricsServer], exports: [MetricsServer] })
export class MetricsModule {}
