-- Outbox events streamed to Kafka (ADR-0020). Events recorded before streaming existed count as
-- already handled: turning Kafka on starts with new events instead of replaying history.

-- AlterTable
ALTER TABLE "outbox_events" ADD COLUMN "streamed_at" TIMESTAMP(3);

UPDATE "outbox_events" SET "streamed_at" = "created_at";

-- CreateIndex
CREATE INDEX "outbox_events_streamed_at_created_at_idx" ON "outbox_events"("streamed_at", "created_at");
