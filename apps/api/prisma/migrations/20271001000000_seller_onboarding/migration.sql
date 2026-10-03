-- Seller onboarding (p8-13): structured business details, branding, shipping settings, the
-- private owner record and resumable application drafts.

CREATE TYPE "BusinessType" AS ENUM ('INDIVIDUAL', 'LLC', 'CORPORATION', 'PARTNERSHIP', 'NONPROFIT');

ALTER TABLE "sellers"
  ADD COLUMN "business_type" "BusinessType",
  ADD COLUMN "category" TEXT,
  ADD COLUMN "what_you_sell" TEXT,
  ADD COLUMN "website" TEXT,
  ADD COLUMN "logo_key" TEXT,
  ADD COLUMN "banner_key" TEXT,
  ADD COLUMN "support_email" TEXT,
  ADD COLUMN "support_phone" TEXT,
  ADD COLUMN "address_line1" TEXT,
  ADD COLUMN "address_line2" TEXT,
  ADD COLUMN "address_city" TEXT,
  ADD COLUMN "address_region" TEXT,
  ADD COLUMN "address_postal_code" TEXT,
  ADD COLUMN "handling_days" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "carriers" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "ship_regions" TEXT[] DEFAULT ARRAY['US_CONTIGUOUS']::TEXT[],
  ADD COLUMN "agreements_accepted_at" TIMESTAMP(3);

CREATE TABLE "seller_owners" (
    "seller_id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "date_of_birth_enc" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "residence_country" CHAR(2) NOT NULL DEFAULT 'US',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_owners_pkey" PRIMARY KEY ("seller_id")
);

CREATE TABLE "seller_application_drafts" (
    "user_id" UUID NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 1,
    "completed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_application_drafts_pkey" PRIMARY KEY ("user_id")
);

ALTER TABLE "seller_owners" ADD CONSTRAINT "seller_owners_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "seller_application_drafts" ADD CONSTRAINT "seller_application_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
