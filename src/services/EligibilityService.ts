import { PrismaClient } from "../../generated/prisma/client";

export class EligibilityService {
  constructor(private prisma: PrismaClient) {}

  async computeEligibility(
    offerId: string,
    offerType: 'Cashback' | 'Exclusive' | 'Loyalty',
    merchantId: string
  ): Promise<void> {
    console.log(`Computing eligibility for ${offerType} offer: ${offerId}`);

    // 1. Get offer details with eligible customer types
    const offer = await this.getOfferDetails(offerId, offerType);
    if (!offer) return;

    // 2. Get all outlets for this merchant
    const outlets = await this.prisma.outlet.findMany({
      where: { merchantId },
    });

    // 3. Get all customer types that match eligibility
    const eligibleCustomerTypes = await this.prisma.customerType.findMany({
      where: {
        merchantId,
        type: { in: offer.eligibleCustomerTypes },
      },
    });

    // 4. Create eligibility records
    const eligibilityRecords = eligibleCustomerTypes.flatMap((ct) =>
      outlets.map((outlet) => ({
        userId: ct.userId,
        outletId: outlet.id,
        offerType,
        offerId,
        merchantId,
        isEligible: true,
        validFrom: offer.startDate || new Date(), // ✅ FIX: Handle null dates
        validUntil: offer.endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // ✅ FIX: Default to 1 year
        lastUpdated: new Date(),
      }))
    );

    // 5. Batch insert (delete old records first)
    await this.prisma.userOfferEligibility.deleteMany({
      where: { offerId, offerType },
    });

    await this.prisma.userOfferEligibility.createMany({
      data: eligibilityRecords,
    });

    console.log(`Created ${eligibilityRecords.length} eligibility records`);
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
          },
        });
      case 'Exclusive':
        return this.prisma.exclusiveOffer.findUnique({
          where: { id: offerId },
          select: {
            eligibleCustomerTypes: true,
            startDate: true,
            endDate: true,
          },
        });
      default:
        return null;
    }
  }
}