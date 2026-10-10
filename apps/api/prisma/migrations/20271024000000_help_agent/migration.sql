-- Help agent (p10-20, ADR-0042): support chats answered from the shopper's orders.
CREATE TYPE "HelpConversationStatus" AS ENUM ('OPEN', 'HANDED_OFF', 'CLOSED');
CREATE TYPE "HelpRole" AS ENUM ('USER', 'AGENT');

CREATE TABLE "help_conversations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "HelpConversationStatus" NOT NULL DEFAULT 'OPEN',
    "order_number" TEXT,
    "support_request_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "help_conversations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "help_conversations_user_id_status_updated_at_idx"
  ON "help_conversations"("user_id", "status", "updated_at");
ALTER TABLE "help_conversations" ADD CONSTRAINT "help_conversations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "help_conversations" ADD CONSTRAINT "help_conversations_support_request_id_fkey"
  FOREIGN KEY ("support_request_id") REFERENCES "support_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "help_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "role" "HelpRole" NOT NULL,
    "text" TEXT NOT NULL,
    "intent" TEXT,
    "data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "help_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "help_messages_conversation_id_created_at_idx"
  ON "help_messages"("conversation_id", "created_at");
ALTER TABLE "help_messages" ADD CONSTRAINT "help_messages_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "help_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
