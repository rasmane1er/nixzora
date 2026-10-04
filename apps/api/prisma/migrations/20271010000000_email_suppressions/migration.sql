-- Addresses we no longer email: hard bounces and spam complaints reported by SES (p9-02).

-- CreateEnum
CREATE TYPE "EmailSuppressionReason" AS ENUM ('BOUNCE', 'COMPLAINT');

-- CreateTable
CREATE TABLE "email_suppressions" (
    "email" TEXT NOT NULL,
    "reason" "EmailSuppressionReason" NOT NULL,
    "detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_suppressions_pkey" PRIMARY KEY ("email")
);
