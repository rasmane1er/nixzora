-- Sign-up details: when the customer accepted the terms (phone and marketing opt-in exist).

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "terms_accepted_at" TIMESTAMP(3);
