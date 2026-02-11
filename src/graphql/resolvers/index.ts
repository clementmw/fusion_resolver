import { prisma } from "../../services/scripts";
import { CacheService } from "../../services/CacheService";
import { OptimizedOffersResolver } from "../../resolvers/OptimizedOffersResolver";
import { eligibilityQueue, redisConnection } from "../../workers/queus";

const cacheService = new CacheService(redisConnection);
const offersResolver = new OptimizedOffersResolver(prisma, cacheService);

export const resolvers = {
  Query: {
    offers: async (_: any, args: { userId: string; outletId?: string }) => {
      return await offersResolver.getOffers(args.userId, args.outletId);
    },

    userLoyaltyPoints: async (_: any, args: { userId: string }) => {
      return await prisma.userLoyaltyPoints.findFirst({
        where: { id: args.userId },
      });
    },
  },

  Mutation: {
    createCashbackOffer: async (_: any, args: { input: any }) => {
      const { input } = args;

      // 1. Save to database
      const offer = await prisma.cashbackConfiguration.create({
        data: {
          id: input.id,
          name: input.name,
          merchantId: input.merchantId,
          eligibleCustomerTypes: input.eligibleCustomerTypes,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          isActive: true,
        },
      });

      // 2. Publish to queue for background processing
      await eligibilityQueue.add('compute-eligibility', {
        offerChangeEvent: {
          eventType: 'created',
          offerType: 'Cashback',
          offerId: offer.id,
          merchantId: offer.merchantId,
          timestamp: new Date(),
        },
        priority: 'high',
        retryCount: 0,
      });

      console.log(`📤 Published eligibility job for offer: ${offer.id}`);

      return offer;
    },

    updateLoyaltyPoints: async (_: any, args: { userId: string; points: number }) => {
      return await prisma.userLoyaltyPoints.update({
        where: { id: args.userId },
        data: { points: args.points },
      });
    },
  },
};