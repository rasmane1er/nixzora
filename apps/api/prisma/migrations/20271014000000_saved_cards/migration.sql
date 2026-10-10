-- Saved cards and 1-click (p10-09): the provider keeps the card; NIXZORA keeps brand, last four
-- digits and expiry for display, and which payments asked to save their card.
ALTER TABLE "users" ADD COLUMN "payment_customer_id" TEXT;
CREATE UNIQUE INDEX "users_payment_customer_id_key" ON "users"("payment_customer_id");

ALTER TABLE "payments" ADD COLUMN "save_card" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "payment_card_id" UUID;

CREATE TABLE "payment_cards" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "provider_method_id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "last4" CHAR(4) NOT NULL,
    "exp_month" INTEGER NOT NULL,
    "exp_year" INTEGER NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_cards_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payment_cards_provider_method_id_key" ON "payment_cards"("provider_method_id");
CREATE INDEX "payment_cards_user_id_idx" ON "payment_cards"("user_id");
ALTER TABLE "payment_cards" ADD CONSTRAINT "payment_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
