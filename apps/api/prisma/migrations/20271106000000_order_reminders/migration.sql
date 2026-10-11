-- Warranty tracker and return-window reminders (p10-33)
ALTER TABLE "users" ADD COLUMN "order_reminders" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "products" ADD COLUMN "warranty_months" INTEGER;
ALTER TABLE "orders" ADD COLUMN "return_reminded_at" TIMESTAMP(3);
ALTER TABLE "order_items" ADD COLUMN "warranty_months" INTEGER,
  ADD COLUMN "warranty_reminded_at" TIMESTAMP(3);
