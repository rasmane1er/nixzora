-- Sign in with Google / Apple: linked provider accounts.
CREATE TYPE "IdentityProvider" AS ENUM ('GOOGLE', 'APPLE');

CREATE TABLE "user_identities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "IdentityProvider" NOT NULL,
    "subject" TEXT NOT NULL,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_identities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_identities_provider_subject_key" ON "user_identities"("provider", "subject");
CREATE INDEX "user_identities_user_id_idx" ON "user_identities"("user_id");

ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
