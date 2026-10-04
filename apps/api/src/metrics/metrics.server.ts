import { createServer, type Server } from 'node:http';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env } from '../config/env';
import { initMetrics, registry } from './metrics';

/**
 * Serves GET /metrics on METRICS_PORT (default 9464), separate from the app's own port so the
 * load balancer never exposes it. Prometheus (or the ADOT collector next to the task) scrapes it.
 */
@Injectable()
export class MetricsServer implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(MetricsServer.name);
  private server?: Server;

  constructor(private readonly config: ConfigService<Env, true>) {
    initMetrics(process.env.NIXZORA_PROCESS ?? 'api');
  }

  onApplicationBootstrap(): void {
    const port = this.config.get('METRICS_PORT', { infer: true });
    if (!port || this.config.get('NODE_ENV', { infer: true }) === 'test') return;
    this.server = createServer((req, res) => {
      if (req.method !== 'GET' || req.url !== '/metrics') {
        res.writeHead(404).end();
        return;
      }
      void registry
        .metrics()
        .then((body) => {
          res.writeHead(200, { 'content-type': registry.contentType });
          res.end(body);
        })
        .catch((error: Error) => {
          res.writeHead(500).end(error.message);
        });
    });
    this.server.on('error', (error) => this.logger.warn(`Metrics port ${port}: ${error.message}`));
    this.server.listen(port, () => this.logger.log(`Metrics on :${port}/metrics`));
  }

  onModuleDestroy(): void {
    this.server?.close();
  }
}
