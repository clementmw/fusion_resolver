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

    offersByMerchant: async (_: any, args: { merchantId: string }) => {
      const offers = await prisma.cashbackConfiguration.findMany({
        where: { merchantId: args.merchantId },
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

      return offers.map(offer => ({
        id: offer.id,
        name: offer.name,
        startDate: offer.startDate?.toISOString() || null,
        endDate: offer.endDate?.toISOString() || null,
        isActive: offer.isActive,
        merchantId: offer.merchantId,
        eligibleCustomerTypes: offer.eligibleCustomerTypes,
        outlets: offer.Outlets,
        netCashbackBudget: Number(offer.netCashbackBudget),
        usedCashbackBudget: Number(offer.usedCashbackBudget),
      }));
    },
  },

  Mutation: {
    createOffer: async (_: any, args: { input: any }) => {
      const { input } = args;

      if (input.offerType === 'CASHBACK') {
        const offer = await prisma.cashbackConfiguration.create({
          data: {
            name: input.name,
            merchantId: input.merchantId,
            eligibleCustomerTypes: input.eligibleCustomerTypes,
            startDate: new Date(input.startDate),
            endDate: new Date(input.endDate),
            isActive: true,
            netCashbackBudget: input.netCashbackBudget || 0,
            usedCashbackBudget: 0,
            Outlets: {
              connect: input.outletIds.map(id => ({ id })),
            },
          },
        });

        await eligibilityQueue.add('compute-eligibility', {
          offerChangeEvent: {
            eventType: 'created',
            offerType: 'Cashback',
            offerId: offer.id,
            merchantId: offer.merchantId,
            timestamp: new Date(),
          },
          priority: 'high', //can change priority here
          retryCount: 0,
        });

        return {
          id: offer.id,
          name: offer.name,
          offerType: 'Cashback',
          startDate: offer.startDate?.toISOString(),
          endDate: offer.endDate?.toISOString(),
          merchantId: offer.merchantId,
          isActive: offer.isActive,
          outlets: [],
        };
      } 
      
      else if (input.offerType === 'EXCLUSIVE') {
        const offer = await prisma.exclusiveOffer.create({
          data: {
            name: input.name,
            description: input.description || '',
            merchantId: input.merchantId,
            eligibleCustomerTypes: input.eligibleCustomerTypes,
            startDate: new Date(input.startDate),
            endDate: new Date(input.endDate),
            isActive: true,
            netOfferBudget: input.netCashbackBudget || 0,
            usedOfferBudget: 0,
            Outlets: {
              connect: input.outletIds.map(id => ({ id })),
            },
          },
        });

        await eligibilityQueue.add('compute-eligibility', {
          offerChangeEvent: {
            eventType: 'created',
            offerType: 'Exclusive',
            offerId: offer.id,
            merchantId: offer.merchantId,
            timestamp: new Date(),
          },
          priority: 'high',
          retryCount: 0,
        });

        return {
          id: offer.id,
          name: offer.name,
          offerType: 'Exclusive',
          description: offer.description,
          startDate: offer.startDate.toISOString(),
          endDate: offer.endDate.toISOString(),
          merchantId: offer.merchantId,
          isActive: offer.isActive,
          outlets: [],
        };
      }

      throw new Error('Invalid offer type');
    },

    updateLoyaltyPoints: async (_: any, args: { userId: string; points: number }) => {
      return await prisma.userLoyaltyPoints.update({
        where: { id: args.userId },
        data: { points: args.points },
      });
    },
  },
};