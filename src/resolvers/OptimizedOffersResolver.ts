import { PrismaClient } from "../../generated/prisma/client";
import { CacheService } from "../services/CacheService";

interface OffersResponse {
  offers: Offer[];
  total: number;
  hasMore: boolean;
  page: number;
}
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

  async getOffers(userId: string, outletId?: string, offerType?: string,limit: number = 100,
      page: number = 1): Promise<OffersResponse> {

    const userMerchants = await this.prisma.customerType.findMany({
      where: { userId },
      select: { merchantId: true }
    });

    const merchantIds = userMerchants.map(m => m.merchantId).join(',');
    // 1. Try cache first
    const cacheKey = `offers:${userId}:outlet:${outletId || 'all'}:type:${offerType || 'all'}:merchants:${merchantIds}:page:${page}:limit:${limit}`;
    const cached = await this.cacheService.get<OffersResponse>(cacheKey);

    if (cached) {
    console.log(' RETURNING CACHED DATA:', JSON.stringify(cached, null, 2));
    return cached;
    }


    console.log(' Cache MISS - Querying database ni mbaya');

    // 2. Query UserOfferEligibility table (precomputed eligibility)
    const now = new Date();

    const total = await this.prisma.userOfferEligibility.count({
      where: {
        userId,
        ...(outletId && { outletId }),
        ...(offerType && { offerType }),
        isEligible: true,
        validFrom: { lte: now },
        validUntil: { gte: now },
      },
    });

    const eligibilityRecords = await this.prisma.userOfferEligibility.findMany({
      where: {
        userId,
        ...(outletId && { outletId }),
        ...(offerType && { offerType }),
        isEligible: true,
        validFrom: { lte: now },
        validUntil: { gte: now },
        
      },
      skip:(page -1 ) * limit,
      take: limit,
      orderBy: {createdAt: 'desc'}
    });

    console.log(`Found ${eligibilityRecords.length} eligible offers`);

    if (eligibilityRecords.length === 0) {
      const emptyResponse: OffersResponse = {
        offers: [],
        total: 0,
        hasMore: false,
        page,
      };
      await this.cacheService.set(cacheKey, emptyResponse, 60);
      return emptyResponse;
    }

    // 3. Enrich with offer details
    const offers = await this.enrichOffers(eligibilityRecords);
    
    const response: OffersResponse = {
      offers,
      total,
      hasMore: page * limit < total,
      page,
    };

    // 4. Cache the result
    await this.cacheService.set(cacheKey, response, 300); // Cache for 5 minutes
    console.log(' Cached result');

    return response;
  }

private async enrichOffers(
  eligibilityRecords: Array<{
    offerId: string;
    offerType: string;
    merchantId: string;
    validFrom: Date;
    validUntil: Date;
  }>
): Promise<Offer[]> {
  const offers: Offer[] = [];

  const eligibilityMap = new Map(
    eligibilityRecords.map(r => [r.offerId, r])
  );

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

    // cashback and exclusive offers by merchant :-can be switched up to be one function instead of 2 (N+1)
    const cashbackOffers: Offer[] = cashbacks.map((cb) => {
      const eligibility = eligibilityMap.get(cb.id)!; 
      
      return {
        id: cb.id,
        name: cb.name,
        description: null,
        offerType: 'Cashback',  // to be refactored to use enums
        startDate: cb.startDate?.toISOString() || new Date().toISOString(),
        endDate: cb.endDate?.toISOString() || new Date().toISOString(),
        isActive: cb.isActive,
        merchantId: cb.merchantId,
        outlets: cb.Outlets,
        validFrom: eligibility.validFrom.toISOString(),   
        validUntil: eligibility.validUntil.toISOString(), 
      };
    });

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

    const exclusiveOffers: Offer[] = exclusives.map((ex) => {
      const eligibility = eligibilityMap.get(ex.id)!; 
      
      return {
        id: ex.id,
        name: ex.name,
        description: ex.description,
        offerType: 'Exclusive',
        startDate: ex.startDate.toISOString(),
        endDate: ex.endDate.toISOString(),
        isActive: ex.isActive,
        merchantId: ex.merchantId || '',
        outlets: ex.Outlets,
        validFrom: eligibility.validFrom.toISOString(),   
        validUntil: eligibility.validUntil.toISOString(), 
      };
    });

    offers.push(...exclusiveOffers);
  }

  return offers;
}
}