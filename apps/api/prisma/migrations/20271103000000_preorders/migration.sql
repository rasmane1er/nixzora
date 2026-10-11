-- Pre-orders (p10-30, ADR-0052): a release date on products, and the day a pre-ordered line ships from.
ALTER TABLE "products" ADD COLUMN "release_date" DATE;
ALTER TABLE "order_items" ADD COLUMN "ships_on" DATE;
