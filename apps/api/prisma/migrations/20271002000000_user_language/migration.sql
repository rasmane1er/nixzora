-- The customer's language (p8-14): website, app, emails and push.
ALTER TABLE "users" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';
