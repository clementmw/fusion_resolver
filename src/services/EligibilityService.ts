import { PrismaClient } from "../../generated/prisma/client";

export class EligibilityService {
  constructor(private prisma: PrismaClient) {}

  async computeEligibility(
    offerId: string,
    offerType: 'Cashback' | 'Exclusive' | 'Loyalty',
    merchantId: string
  ): Promise<void> {
    console.log(`Computing eligibility for ${offerType} offer: ${offerId}`);

    // 1. Get offer details
    const offer = await this.getOfferDetails(offerId, offerType);
    if (!offer) {
      console.error(`Offer ${offerId} not found`);
      // Delete all eligibility for this offer
      await this.prisma.userOfferEligibility.deleteMany({
        where: { offerId, offerType },
      });
      return;
    }

    // 2. Check if offer should be eligible
    if (!offer.isActive || offer.deletedAt) {
      console.log(`Offer ${offerId} is inactive/deleted - removing eligibility`);
      await this.prisma.userOfferEligibility.deleteMany({
        where: { offerId, offerType },
      });
      return;
    }

    // 3. Get outlets
    const outlets = await this.prisma.outlet.findMany({
      where: { 
        merchantId,
        isActive: true, //  Only active outlets
      },
    });

    if (outlets.length === 0) {
      console.log(`No active outlets for merchant ${merchantId}`);
      await this.prisma.userOfferEligibility.deleteMany({
        where: { offerId, offerType },
      });
      return;
    }

    // 4. Get eligible customer types (handle "All" case)
    let eligibleCustomerTypes;
    
    if (offer.eligibleCustomerTypes.includes('All')) {
      // ✅ Get ALL customer types for this merchant
      eligibleCustomerTypes = await this.prisma.customerType.findMany({
        where: { merchantId },
      });
    } else {
      // ✅ Get specific customer types
      eligibleCustomerTypes = await this.prisma.customerType.findMany({
        where: {
          merchantId,
          type: { in: offer.eligibleCustomerTypes },
        },
      });
    }

    // 5. Build new eligibility records (what SHOULD exist)
    const newEligibilityRecords = eligibleCustomerTypes.flatMap((ct) =>
      outlets.map((outlet) => ({
        userId: ct.userId,
        outletId: outlet.id,
        offerType,
        offerId,
        merchantId,
        isEligible: true,
        validFrom: offer.startDate || new Date(),
        validUntil: offer.endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        lastUpdated: new Date(),
      }))
    );

    // 6. Get existing records
    const existingRecords = await this.prisma.userOfferEligibility.findMany({
      where: { offerId, offerType },
      select: {
        id: true,
        userId: true,
        outletId: true,
        validFrom: true,
        validUntil: true,
      },
    });

    // 7. Diff
    const existingKeys = new Set(
      existingRecords.map(r => `${r.userId}:${r.outletId}`)
    );
    const newKeys = new Set(
      newEligibilityRecords.map(r => `${r.userId}:${r.outletId}`)
    );

    const toCreate = newEligibilityRecords.filter(
      r => !existingKeys.has(`${r.userId}:${r.outletId}`)
    );

    const toDelete = existingRecords.filter(
      r => !newKeys.has(`${r.userId}:${r.outletId}`)
    );

    const toUpdate = existingRecords
      .filter(existing => {
        if (!newKeys.has(`${existing.userId}:${existing.outletId}`)) {
          return false;
        }
        const newRecord = newEligibilityRecords.find(
          n => n.userId === existing.userId && n.outletId === existing.outletId
        );
        if (!newRecord) return false;
        
        return existing.validFrom?.getTime() !== newRecord.validFrom.getTime() ||
               existing.validUntil?.getTime() !== newRecord.validUntil.getTime();
      })
      .map(existing => {
        const newRecord = newEligibilityRecords.find(
          n => n.userId === existing.userId && n.outletId === existing.outletId
        )!;
        
        return {
          id: existing.id,
          validFrom: newRecord.validFrom,
          validUntil: newRecord.validUntil,
          lastUpdated: new Date(),
        };
      });

    // 8. Execute in transaction
    await this.prisma.$transaction(async (tx) => {
      if (toDelete.length > 0) {
        await tx.userOfferEligibility.deleteMany({
          where: { id: { in: toDelete.map(r => r.id) } },
        });
      }
        if (toUpdate.length > 0) {
          const UPDATE_BATCH_SIZE = 500;

          for (let i = 0; i < toUpdate.length; i += UPDATE_BATCH_SIZE) {
            const batch = toUpdate.slice(i, i + UPDATE_BATCH_SIZE);

            for (const record of batch) {
              await tx.userOfferEligibility.update({
                where: { id: record.id },
                data: {
                  validFrom: record.validFrom,
                  validUntil: record.validUntil,
                  lastUpdated: record.lastUpdated,
                },
              });
            }
          }
        }


      if (toCreate.length > 0) {
        await this.batchCreateMany(tx, toCreate, 1000);
      }
    });

    console.log(
      `✅ Eligibility sync complete: ` +
      `Created ${toCreate.length}, ` +
      `Updated ${toUpdate.length}, ` +
      `Deleted ${toDelete.length}`
    );
  }

  private async batchCreateMany(
    tx: any,
    records: any[],
    batchSize: number
  ): Promise<void> {
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      await tx.userOfferEligibility.createMany({
        data: batch,
        skipDuplicates: true,
      });
    }
  }

  private async getOfferDetails(offerId: string, offerType: string) {
    switch (offerType) {
      case 'Cashback':
        return this.prisma.cashbackConfiguration.findUnique({
          where: { id: offerId },
          select: {
            eligibleCustomerTypes: true,
            startDate: true,
            endDate: true,
            isActive: true, // ✅ Include status
            deletedAt: true, // ✅ Include deletion
          },
        });
      case 'Exclusive':
        return this.prisma.exclusiveOffer.findUnique({
          where: { id: offerId },
          select: {
            eligibleCustomerTypes: true,
            startDate: true,
            endDate: true,
            isActive: true,
            deletedAt: true,
          },
        });
      case 'Loyalty':
        // ✅ Handle loyalty program
        const loyalty = await this.prisma.loyaltyProgram.findUnique({
          where: { id: offerId },
          select: {
            isActive: true,
            LoyaltyTiers: {
              where: { isActive: true, deletedAt: null },
              select: { minCustomerType: true },
            },
          },
        });
        
        if (!loyalty) return null;
        
        // Extract eligible customer types from tiers
        const eligibleTypes = loyalty.LoyaltyTiers.map(t => t.minCustomerType);
        
        return {
          eligibleCustomerTypes: eligibleTypes,
          startDate: null,
          endDate: null,
          isActive: loyalty.isActive,
          deletedAt: null,
        };
      default:
        return null;
    }
  }
}