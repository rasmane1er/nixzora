-- "Remind me to buy" (p10-36)
CREATE TABLE "buy_reminders" (
    "user_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "remind_on" DATE NOT NULL,
    "remind_at" TIMESTAMP(3) NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buy_reminders_pkey" PRIMARY KEY ("user_id","product_id")
);

CREATE INDEX "buy_reminders_remind_at_idx" ON "buy_reminders"("remind_at");

ALTER TABLE "buy_reminders" ADD CONSTRAINT "buy_reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "buy_reminders" ADD CONSTRAINT "buy_reminders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
