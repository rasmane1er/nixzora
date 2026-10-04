import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import {
  type SellerApplication,
  type SellerApplicationDraft,
  type SellerApplicationDraftView,
  type SellerBrandingUpload,
  type SellerView,
} from '@nixzora/validation';
import { isUniqueViolation } from '../../common/prisma-errors';
import { type Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { type ActorContext } from '../identity/guards/actor.decorator';
import { MediaIntakeService } from '../media/media-intake.service';
import { StorageService } from '../media/storage.service';
import { SellerPii } from './seller-pii';
import { SellersService } from './sellers.service';

/**
 * The seller application (p8-13): a draft saved after each of the six steps, branding uploads,
 * and the final submission that creates the store (PENDING until staff approve it).
 */
@Injectable()
export class SellerOnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly intake: MediaIntakeService,
    private readonly sellers: SellersService,
    private readonly pii: SellerPii,
  ) {}

  async draft(userId: string): Promise<SellerApplicationDraftView | null> {
    const row = await this.prisma.sellerApplicationDraft.findUnique({ where: { userId } });
    if (!row) return null;
    return {
      step: row.step,
      completed: row.completed as SellerApplicationDraft['completed'],
      data: row.data as Record<string, unknown>,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async saveDraft(
    userId: string,
    input: SellerApplicationDraft,
  ): Promise<SellerApplicationDraftView> {
    if (await this.sellers.context(userId)) {
      throw new ConflictException('You already have a seller account.');
    }
    const data = input.data as Prisma.InputJsonValue;
    const row = await this.prisma.sellerApplicationDraft.upsert({
      where: { userId },
      create: { userId, step: input.step, completed: input.completed, data },
      update: { step: input.step, completed: input.completed, data },
    });
    return {
      step: row.step,
      completed: row.completed as SellerApplicationDraft['completed'],
      data: row.data as Record<string, unknown>,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async discardDraft(userId: string): Promise<void> {
    await this.prisma.sellerApplicationDraft.deleteMany({ where: { userId } });
  }

  /** An upload slot for a logo or banner, before or after the store exists. */
  brandingUpload(input: SellerBrandingUpload) {
    return this.storage.createUpload(input.contentType, input.sizeBytes);
  }

  async apply(input: SellerApplication, actor: ActorContext): Promise<SellerView> {
    if (await this.sellers.context(actor.user.id)) {
      throw new ConflictException('You already have a seller account.');
    }
    for (const key of [input.logoKey, input.bannerKey]) {
      if (key && !(await this.intake.ensureReady(key))) {
        throw new BadRequestException('Upload the image again: we could not find it.');
      }
    }
    const handle = input.handle ?? (await this.sellers.availableHandle(input.displayName));
    try {
      const seller = await this.prisma.$transaction(async (tx) => {
        const created = await tx.seller.create({
          data: {
            handle,
            displayName: input.displayName,
            legalName: input.legalName,
            contactEmail: input.contactEmail ?? actor.user.email,
            country: input.address.country,
            description: input.description,
            businessType: input.businessType,
            category: input.category,
            whatYouSell: input.whatYouSell,
            website: input.website ?? null,
            logoKey: input.logoKey ?? null,
            bannerKey: input.bannerKey ?? null,
            supportEmail: input.supportEmail ?? null,
            supportPhone: input.supportPhone ?? null,
            addressLine1: input.address.line1,
            addressLine2: input.address.line2 ?? null,
            addressCity: input.address.city,
            addressRegion: input.address.region,
            addressPostalCode: input.address.postalCode,
            handlingDays: input.handlingDays,
            carriers: input.carriers,
            shipRegions: input.shipRegions,
            agreementsAcceptedAt: new Date(),
            members: { create: { userId: actor.user.id, role: 'OWNER' } },
            owner: {
              create: {
                firstName: input.owner.firstName,
                lastName: input.owner.lastName,
                dateOfBirthEnc: this.pii.seal(input.owner.dateOfBirth),
                phone: input.owner.phone,
                residenceCountry: input.owner.residenceCountry,
              },
            },
          },
        });
        await tx.sellerApplicationDraft.deleteMany({ where: { userId: actor.user.id } });
        await tx.outboxEvent.create({
          data: {
            aggregateType: 'seller',
            aggregateId: created.id,
            type: 'seller.applied',
            payload: { sellerId: created.id, handle },
          },
        });
        return created;
      });
      // The owner's personal details are not part of the audit trail.
      await this.audit.record({
        action: 'seller.applied',
        actorType: 'USER',
        actorId: actor.user.id,
        entityType: 'seller',
        entityId: seller.id,
        meta: actor.meta,
        metadata: { handle, businessType: input.businessType, category: input.category },
      });
      return this.sellers.view(seller);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          input.handle
            ? 'That store address is taken. Choose another.'
            : 'You already have a seller account.',
        );
      }
      throw error;
    }
  }
}
