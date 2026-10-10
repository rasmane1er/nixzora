import { randomBytes } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  MAX_LIST_ITEMS,
  MAX_LISTS,
  type SharedListView,
  type ShoppingListCreate,
  type ShoppingListItemInput,
  type ShoppingListSummary,
  type ShoppingListUpdate,
  type ShoppingListView,
} from '@nixzora/validation';
import { type Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CatalogQueryService } from '../catalog/catalog-query.service';
import { StorageService } from '../media/storage.service';
import { authorName } from './reviews.service';

const listInclude = {
  items: {
    orderBy: { createdAt: 'desc' },
    include: {
      product: {
        select: {
          images: { orderBy: { position: 'asc' }, take: 1, select: { storageKey: true } },
        },
      },
    },
  },
  user: { select: { firstName: true, lastName: true } },
} satisfies Prisma.ShoppingListInclude;
type ListRow = Prisma.ShoppingListGetPayload<{ include: typeof listInclude }>;

const newToken = () => randomBytes(16).toString('base64url');

/**
 * Lists and registries (p10-08). Each belongs to one customer; a shared one can be opened by
 * anyone with its link (unguessable token), and stops working when sharing is turned off or the
 * link is reset. Guests see the owner's first name and initial only.
 */
@Injectable()
export class ListsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogQueryService,
    private readonly storage: StorageService,
  ) {}

  async mine(userId: string): Promise<ShoppingListSummary[]> {
    const rows = await this.prisma.shoppingList.findMany({
      where: { userId },
      include: listInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.summary(row));
  }

  async create(userId: string, input: ShoppingListCreate): Promise<ShoppingListSummary> {
    if ((await this.prisma.shoppingList.count({ where: { userId } })) >= MAX_LISTS) {
      throw new ConflictException(`You can have up to ${MAX_LISTS} lists.`);
    }
    const row = await this.prisma.shoppingList.create({
      data: {
        userId,
        name: input.name,
        kind: input.kind,
        eventDate: input.eventDate ? new Date(`${input.eventDate}T00:00:00Z`) : null,
        note: input.note ?? null,
        isShared: input.isShared ?? input.kind === 'REGISTRY',
        shareToken: newToken(),
      },
      include: listInclude,
    });
    return this.summary(row);
  }

  async update(userId: string, id: string, input: ShoppingListUpdate): Promise<ShoppingListView> {
    await this.own(userId, id);
    await this.prisma.shoppingList.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.kind !== undefined ? { kind: input.kind } : {}),
        ...(input.eventDate !== undefined
          ? { eventDate: input.eventDate ? new Date(`${input.eventDate}T00:00:00Z`) : null }
          : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
        ...(input.isShared !== undefined ? { isShared: input.isShared } : {}),
      },
    });
    return this.view(userId, id);
  }

  /** A new link: the old one stops working. */
  async resetLink(userId: string, id: string): Promise<ShoppingListView> {
    await this.own(userId, id);
    await this.prisma.shoppingList.update({ where: { id }, data: { shareToken: newToken() } });
    return this.view(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.own(userId, id);
    await this.prisma.shoppingList.delete({ where: { id } });
  }

  async view(userId: string, id: string): Promise<ShoppingListView> {
    const row = await this.own(userId, id);
    return this.full(row);
  }

  async addItem(
    userId: string,
    id: string,
    input: ShoppingListItemInput,
  ): Promise<ShoppingListView> {
    await this.own(userId, id);
    const product = await this.prisma.product.findFirst({
      where: { id: input.productId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('That product is not available.');
    if ((await this.prisma.shoppingListItem.count({ where: { listId: id } })) >= MAX_LIST_ITEMS) {
      throw new ConflictException(`A list can hold up to ${MAX_LIST_ITEMS} products.`);
    }
    await this.prisma.shoppingListItem.upsert({
      where: { listId_productId: { listId: id, productId: product.id } },
      create: {
        listId: id,
        productId: product.id,
        quantity: input.quantity ?? 1,
        note: input.note ?? null,
      },
      update: {
        ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
      },
    });
    return this.view(userId, id);
  }

  async removeItem(userId: string, id: string, productId: string): Promise<ShoppingListView> {
    await this.own(userId, id);
    await this.prisma.shoppingListItem.deleteMany({ where: { listId: id, productId } });
    return this.view(userId, id);
  }

  /** Which of this customer's lists hold the product (for the "Add to list" menu). */
  async containing(userId: string, productId: string): Promise<string[]> {
    const rows = await this.prisma.shoppingListItem.findMany({
      where: { productId, list: { userId } },
      select: { listId: true },
    });
    return rows.map((row) => row.listId);
  }

  /** A shared list, for anyone with the link. */
  async shared(token: string): Promise<SharedListView> {
    const row = await this.prisma.shoppingList.findUnique({
      where: { shareToken: token },
      include: listInclude,
    });
    if (!row?.isShared) throw new NotFoundException('This list is private or no longer exists.');
    const { shareToken: _token, isShared: _shared, ...rest } = await this.full(row);
    return { ...rest, owner: authorName(row.user) };
  }

  private async own(userId: string, id: string): Promise<ListRow> {
    const row = await this.prisma.shoppingList.findFirst({
      where: { id, userId },
      include: listInclude,
    });
    if (!row) throw new NotFoundException('List not found.');
    return row;
  }

  private summary(row: ListRow): ShoppingListSummary {
    return {
      id: row.id,
      name: row.name,
      kind: row.kind,
      eventDate: row.eventDate ? row.eventDate.toISOString().slice(0, 10) : null,
      isShared: row.isShared,
      shareToken: row.shareToken,
      itemCount: row.items.length,
      previews: row.items
        .flatMap((item) => item.product.images.slice(0, 1))
        .slice(0, 4)
        .map((image) => this.storage.publicUrl(image.storageKey)),
    };
  }

  private async full(row: ListRow): Promise<ShoppingListView> {
    const cards = new Map(
      (await this.catalog.cardsByIds(row.items.map((item) => item.productId))).map((card) => [
        card.id,
        card,
      ]),
    );
    return {
      ...this.summary(row),
      note: row.note,
      items: row.items.flatMap((item) => {
        const product = cards.get(item.productId);
        return product
          ? [
              {
                product,
                quantity: item.quantity,
                note: item.note,
                addedAt: item.createdAt.toISOString(),
              },
            ]
          : [];
      }),
    };
  }
}
