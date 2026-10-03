import { type ConfigService } from '@nestjs/config';
import { type Env } from '../config/env';

/**
 * Whether timers and start-up passes (outbox delivery, sweepers, payouts, reindexing) run in
 * this process. Never in tests, which call them directly; on the API, not once the notifications
 * worker runs them (ADR-0017).
 */
export function runsBackgroundJobs(config: ConfigService<Env, true>): boolean {
  return (
    config.get('NODE_ENV', { infer: true }) !== 'test' &&
    config.get('BACKGROUND_JOBS', { infer: true })
  );
}
