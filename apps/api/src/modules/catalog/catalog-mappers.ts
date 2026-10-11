import {
  type CardColor,
  colorSwatch,
  deliveryFrom,
  isPreorder,
  productColors,
  twoToneSwatches,
  type Image,
  OWN_HANDLING_DAYS,
  type ProductCard,
  type ProductVideo,
  type Variant,
  videoUrls,
} from '@nixzora/validation';
import { type Prisma } from '../../generated/prisma/client';

/** The relations every product card and detail view needs, loaded in one query. */
export const productInclude = {
  brand: true,
  category: true,
  seller: {
    select: {
      handle: true,
      displayName: true,
      ratingCount: true,
      ratingTotal: true,
      handlingDays: true,
    },
  },
  images: { orderBy: { position: 'asc' } },
  variants: { include: { inventory: true }, orderBy: [{ priceCents: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.ProductInclude;

export type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

export function availableOf(inventory: { onHand: number; reserved: number } | null): number {
  return inventory ? Math.max(0, inventory.onHand - inventory.reserved) : 0;
}

export function toImage(
  image: ProductWithRelations['images'][number],
  publicUrl: (key: string) => string,
): Image {
  return {
    id: image.id,
    url: publicUrl(image.storageKey),
    alt: image.alt,
    position: image.position,
    color: image.color ?? null,
  };
}

export function toVariant(variant: ProductWithRelations['variants'][number]): Variant {
  return {
    id: variant.id,
    sku: variant.sku,
    barcode: variant.barcode,
    title: variant.title,
    options: (variant.options ?? {}) as Record<string, string>,
    priceCents: variant.priceCents,
    compareAtCents: variant.compareAtCents,
    currency: variant.currency,
    available: availableOf(variant.inventory),
    isActive: variant.isActive,
  };
}

export function toCard(
  product: ProductWithRelations,
  publicUrl: (key: string) => string,
): ProductCard {
  const active = product.variants.filter((variant) => variant.isActive);
  const cheapest = active[0] ?? product.variants[0];
  const firstImage = product.images[0];

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    brand: product.brand ? { slug: product.brand.slug, name: product.brand.name } : null,
    category: { slug: product.category.slug, name: product.category.name },
    priceFromCents: cheapest?.priceCents ?? 0,
    compareAtCents: cheapest?.compareAtCents ?? null,
    currency: cheapest?.currency ?? 'USD',
    inStock: active.some((variant) => availableOf(variant.inventory) > 0),
    image: firstImage ? toImage(firstImage, publicUrl) : null,
    defaultVariantId: active.length === 1 ? active[0]!.id : null,
    // When it arrives if ordered now (p10-17): the store's handling time, or NIXZORA's; from the
    // release day for a pre-order (p10-30).
    delivery: deliveryFrom(product.seller?.handlingDays ?? OWN_HANDLING_DAYS, releaseDay(product)),
    ...(isPreorder(releaseDay(product)) ? { preorder: { releaseDate: releaseDay(product)! } } : {}),
    shipsFromNixzora: !product.sellerId,
    ...cardColors(active, product.images, publicUrl),
  };
}

/** Pre-orders (p10-30): the release day as "2026-11-20", or null. */
export function releaseDay(product: { releaseDate: Date | null }): string | null {
  return product.releaseDate ? product.releaseDate.toISOString().slice(0, 10) : null;
}

/** Photos per color (p10-29): a card's swatches, each with that color's first photo. */
function cardColors(
  variants: ProductWithRelations['variants'],
  images: ProductWithRelations['images'],
  publicUrl: (key: string) => string,
): { colors?: CardColor[] } {
  // In the order the store added them (ids are time-ordered), not by price.
  const names = productColors(
    [...variants]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((v) => ({ options: (v.options ?? {}) as Record<string, string> })),
  );
  if (names.length < 2) return {};
  return {
    colors: names.map((name) => {
      const photo = images.find((image) => image.color === name);
      const two = twoToneSwatches(name);
      return {
        name,
        swatch: two ? two[0] : colorSwatch(name),
        ...(two ? { swatch2: two[1] } : {}),
        imageUrl: photo ? publicUrl(photo.storageKey) : null,
      };
    }),
  };
}

/** A product video (p10-28) with where it plays and, for YouTube, its still. */
export function toVideo(video: {
  id: string;
  provider: 'YOUTUBE' | 'VIMEO';
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
}): ProductVideo {
  return {
    id: video.id,
    provider: video.provider,
    videoId: video.videoId,
    title: video.title,
    thumbnailUrl:
      video.thumbnailUrl ??
      (video.provider === 'YOUTUBE'
        ? `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`
        : null),
    ...videoUrls(video),
  };
}
