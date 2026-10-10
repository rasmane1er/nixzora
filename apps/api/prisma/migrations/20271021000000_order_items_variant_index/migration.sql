-- "50+ bought in past month" on product cards (p10-17) and "bought together" read order items
-- by variant.
CREATE INDEX "order_items_variant_id_idx" ON "order_items"("variant_id");
