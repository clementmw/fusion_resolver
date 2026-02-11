import { PrismaClient } from "../../generated/prisma/client";
import { CacheService } from "../services/CacheService";

interface Offer {
  id: string;
  name: string;
  description?: string | null;
  offerType: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  merchantId: string;
  outlets: Array<{
    id: string;
    name: string;
    description?: string | null;
    isActive: boolean;
  }>;
}

export class OptimizedOffersResolver {
  constructor(
    private prisma: PrismaClient,
    private cacheService: CacheService
  ) {}

  async getOffers(userId: string, outletId?: string): Promise<Offer[]> {
    // 1. Try cache first
    const cacheKey = `offers:${userId}:outlet:${outletId || 'all'}`;
    const cached = await this.cacheService.get<Offer[]>(cacheKey);

    if (cached) {
    console.log('🔥 RETURNING CACHED DATA:', JSON.stringify(cached, null, 2));
    return cached;
    }


    console.log('❌ Cache MISS - Querying database ni mbaya');

    // 2. Query UserOfferEligibility table (precomputed eligibility)
    const now = new Date();
    const eligibilityRecords = await this.prisma.userOfferEligibility.findMany({
      where: {
        userId,
        ...(outletId && { outletId }),
        isEligible: true,
        validFrom: { lte: now },
        validUntil: { gte: now },
      },
    });

    console.log(`Found ${eligibilityRecords.length} eligible offers`);

    if (eligibilityRecords.length === 0) {
      // Cache empty result too (prevent repeated queries)
      await this.cacheService.set(cacheKey, [], 60); // Cache for 1 minute
      return [];
    }

    // 3. Enrich with offer details
    const offers = await this.enrichOffers(eligibilityRecords);

    // 4. Cache the result
    await this.cacheService.set(cacheKey, offers, 300); // Cache for 5 minutes
    console.log('💾 Cached result');

    return offers;
  }

  private async enrichOffers(
    eligibilityRecords: Array<{
      offerId: string;
      offerType: string;
      merchantId: string;
    }>
  ): Promise<Offer[]> {
    const offers: Offer[] = [];

    // Group by offer type
    const cashbackIds = eligibilityRecords
      .filter((r) => r.offerType === 'Cashback')
      .map((r) => r.offerId);

    const exclusiveIds = eligibilityRecords
      .filter((r) => r.offerType === 'Exclusive')
      .map((r) => r.offerId);

    // Fetch Cashback offers
    if (cashbackIds.length > 0) {
      const cashbacks = await this.prisma.cashbackConfiguration.findMany({
        where: {
          id: { in: cashbackIds },
          isActive: true,
        },
        include: {
          Outlets: {
            select: {
              id: true,
              name: true,
              description: true,
              isActive: true,
            },
          },
        },
      });

      // Map cashback offers to Offer interface
      const cashbackOffers: Offer[] = cashbacks.map((cb) => ({
        id: cb.id,
        name: cb.name,
        description: null,
        offerType: 'Cashback', // ✅ CRITICAL: Set offerType explicitly
        startDate: cb.startDate?.toISOString() || new Date().toISOString(),
        endDate: cb.endDate?.toISOString() || new Date().toISOString(),
        isActive: cb.isActive,
        merchantId: cb.merchantId,
        outlets: cb.Outlets,
      }));

      offers.push(...cashbackOffers);
    }

    // Fetch Exclusive offers
    if (exclusiveIds.length > 0) {
      const exclusives = await this.prisma.exclusiveOffer.findMany({
        where: {
          id: { in: exclusiveIds },
          isActive: true,
        },
        include: {
          Outlets: {
            select: {
              id: true,
              name: true,
              description: true,
              isActive: true,
            },
          },
        },
      });

      // Map exclusive offers to Offer interface
      const exclusiveOffers: Offer[] = exclusives.map((ex) => ({
        id: ex.id,
        name: ex.name,
        description: ex.description,
        offerType: 'Exclusive', // ✅ CRITICAL: Set offerType explicitly
        startDate: ex.startDate.toISOString(),
        endDate: ex.endDate.toISOString(),
        isActive: ex.isActive,
        merchantId: ex.merchantId || '',
        outlets: ex.Outlets,
      }));

      offers.push(...exclusiveOffers);
    }
    // console.log('Final offers being returned:', JSON.stringify(offers, null, 2));

    return offers;
  }
}