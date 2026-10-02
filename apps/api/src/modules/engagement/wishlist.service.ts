import { Injectable, NotFoundException } from '@nestjs/common';
import { type ProductCard } from '@nixzora/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { CatalogQueryService } from '../catalog/catalog-query.service';

const MAX_ITEMS = 200;

@Injectable()
export class WishlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogQueryService,
  ) {}

  async list(userId: string): Promise<ProductCard[]> {
    const rows = await this.prisma.wishlistItem.findMany({
      where: { userId, product: { status: 'ACTIVE' } },
      orderBy: { createdAt: 'desc' },
      take: MAX_ITEMS,
    });
    return this.catalog.cardsByIds(rows.map((row) => row.productId));
  }

  async ids(userId: string): Promise<string[]> {
    const rows = await this.prisma.wishlistItem.findMany({
      where: { userId },
      select: { productId: true },
    });
    return rows.map((row) => row.productId);
  }

  async add(userId: string, productId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, status: 'ACTIVE' },
    });
    if (!product) throw new NotFoundException('That product is not available.');
    const count = await this.prisma.wishlistItem.count({ where: { userId } });
    if (count >= MAX_ITEMS) return;
    await this.prisma.wishlistItem.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId },
      update: {},
    });
  }

  async remove(userId: string, productId: string): Promise<void> {
    await this.prisma.wishlistItem.deleteMany({ where: { userId, productId } });
  }
}
