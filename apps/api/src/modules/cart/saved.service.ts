import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { type CartAndSaved, MAX_SAVED_ITEMS, type SavedItem } from '@nixzora/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { availableOf } from '../catalog/catalog-mappers';
import { StorageService } from '../media/storage.service';
import { PlusBenefits } from '../plus/plus-benefits.service';
import { CartService } from './cart.service';

/**
 * Saved for later (p10-21, ADR-0043): items moved out of the cart onto the account, newest
 * first. Prices are read from the catalog every time, like the cart; the price at saving time
 * is kept only to show what changed.
 */
@Injectable()
export class SavedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly carts: CartService,
    private readonly storage: StorageService,
    private readonly plus: PlusBenefits,
  ) {}

  async list(userId: string): Promise<SavedItem[]> {
    const rows = await this.prisma.savedItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: MAX_SAVED_ITEMS,
      include: {
        variant: {
          include: {
            inventory: true,
            product: { include: { images: { orderBy: { position: 'asc' }, take: 1 } } },
          },
        },
      },
    });
    const member = rows.length ? await this.plus.isMember(userId) : false;
    const memberPrices = member
      ? await this.plus.memberPrices(rows.map((r) => r.variant))
      : new Map<string, number>();
    return rows.map(({ variant, ...row }) => {
      const image = variant.product.images[0];
      const sellable = variant.isActive && variant.product.status === 'ACTIVE';
      return {
        variantId: variant.id,
        productId: variant.productId,
        productSlug: variant.product.slug,
        productTitle: variant.product.title,
        variantTitle: variant.title,
        imageUrl: image ? this.storage.publicUrl(image.storageKey) : null,
        priceCents: memberPrices.get(variant.id) ?? variant.priceCents,
        currency: variant.currency,
        savedPriceCents: row.savedPriceCents,
        quantity: row.quantity,
        savedAt: row.createdAt.toISOString(),
        problem: sellable && availableOf(variant.inventory) > 0 ? null : 'UNAVAILABLE',
      };
    });
  }

  /** Moves a cart line to the saved list, at the price the shopper sees now. */
  async save(userId: string, variantId: string): Promise<CartAndSaved> {
    const owner = { userId };
    const line = (await this.carts.view(owner)).lines.find((l) => l.variantId === variantId);
    if (!line) throw new NotFoundException('That item is not in your cart.');
    const existing = await this.prisma.savedItem.findUnique({
      where: { userId_variantId: { userId, variantId } },
    });
    if (
      !existing &&
      (await this.prisma.savedItem.count({ where: { userId } })) >= MAX_SAVED_ITEMS
    ) {
      throw new BadRequestException(`You can save up to ${MAX_SAVED_ITEMS} items for later.`);
    }
    await this.prisma.savedItem.upsert({
      where: { userId_variantId: { userId, variantId } },
      create: { userId, variantId, quantity: line.quantity, savedPriceCents: line.unitPriceCents },
      // Saved again: the newest quantity and price, and back to the top of the list.
      update: {
        quantity: line.quantity,
        savedPriceCents: line.unitPriceCents,
        createdAt: new Date(),
      },
    });
    const cart = await this.carts.setQuantity(owner, variantId, 0);
    return { cart, saved: await this.list(userId) };
  }

  /** Back to the cart (sold-out items stay saved: the cart refuses them). */
  async moveToCart(userId: string, variantId: string): Promise<CartAndSaved> {
    const row = await this.prisma.savedItem.findUnique({
      where: { userId_variantId: { userId, variantId } },
    });
    if (!row) throw new NotFoundException('That item is not in your saved items.');
    const cart = await this.carts.add({ userId }, variantId, row.quantity);
    await this.prisma.savedItem.delete({ where: { userId_variantId: { userId, variantId } } });
    return { cart, saved: await this.list(userId) };
  }

  async remove(userId: string, variantId: string): Promise<SavedItem[]> {
    await this.prisma.savedItem.deleteMany({ where: { userId, variantId } });
    return this.list(userId);
  }
}
