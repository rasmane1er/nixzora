import { Global, Module } from '@nestjs/common';
import { KafkaService } from './kafka.service';

/** One Kafka connection per process (ADR-0020); inactive without KAFKA_BROKERS. */
@Global()
@Module({ providers: [KafkaService], exports: [KafkaService] })
export class KafkaModule {}
