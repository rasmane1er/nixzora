-- Your Account: profile photo, coupons listed in accounts, and customer support requests.
ALTER TABLE "users" ADD COLUMN "avatar_key" TEXT;
ALTER TABLE "coupons" ADD COLUMN "is_public" BOOLEAN NOT NULL DEFAULT false;

CREATE TYPE "SupportTopic" AS ENUM ('ORDER', 'DELIVERY', 'RETURN', 'PAYMENT', 'ACCOUNT', 'PRODUCT', 'PROBLEM', 'OTHER');
CREATE TYPE "SupportStatus" AS ENUM ('OPEN', 'ANSWERED', 'CLOSED');

CREATE TABLE "support_requests" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "user_id" UUID,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "topic" "SupportTopic" NOT NULL,
    "order_number" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "SupportStatus" NOT NULL DEFAULT 'OPEN',
    "staff_reply" TEXT,
    "page_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "answered_at" TIMESTAMP(3),

    CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "support_requests_reference_key" ON "support_requests"("reference");
CREATE INDEX "support_requests_status_created_at_idx" ON "support_requests"("status", "created_at");
CREATE INDEX "support_requests_user_id_created_at_idx" ON "support_requests"("user_id", "created_at");

ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Reference data: staff permission to read and answer support requests.
INSERT INTO "permissions" ("id", "key", "description") VALUES
  (gen_random_uuid(), 'support.manage', 'Read and answer customer support requests')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM (VALUES
  ('support', 'support.manage'),
  ('admin', 'support.manage')
) AS grants("role_key", "permission_key")
JOIN "roles" r ON r."key" = grants."role_key"
JOIN "permissions" p ON p."key" = grants."permission_key"
ON CONFLICT DO NOTHING;
