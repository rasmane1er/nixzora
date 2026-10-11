-- Store vacation mode (p10-32, ADR-0055).
ALTER TABLE "sellers" ADD COLUMN "vacation_from" DATE;
ALTER TABLE "sellers" ADD COLUMN "vacation_until" DATE;
ALTER TABLE "sellers" ADD COLUMN "vacation_message" TEXT;
