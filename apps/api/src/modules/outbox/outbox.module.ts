import { Global, Module } from '@nestjs/common';
import { OutboxStreamer } from './outbox-streamer';
import { OutboxService } from './outbox.service';

@Global()
@Module({ providers: [OutboxService, OutboxStreamer], exports: [OutboxService, OutboxStreamer] })
export class OutboxModule {}
