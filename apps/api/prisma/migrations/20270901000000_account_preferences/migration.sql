-- Your Account: communication preferences.
ALTER TABLE "users" ADD COLUMN "marketing_emails" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "review_requests" BOOLEAN NOT NULL DEFAULT true;
