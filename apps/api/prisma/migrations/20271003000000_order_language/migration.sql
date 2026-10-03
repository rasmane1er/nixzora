-- The language the customer checked out in: emails for guest orders use it.
ALTER TABLE "orders" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';
