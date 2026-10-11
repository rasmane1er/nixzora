-- Photos per color (p10-29, ADR-0051): a photo can show one of the product's colors.
ALTER TABLE "product_images" ADD COLUMN "color" TEXT;
