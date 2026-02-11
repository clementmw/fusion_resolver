import 'dotenv/config';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { prisma } from '../src/services/scripts';
import { OptimizedOffersResolver } from '../src/resolvers/OptimizedOffersResolver';
import { CacheService } from '../src/services/CacheService';
import { EligibilityService } from '../src/services/EligibilityService';
import Redis from 'ioredis';

const redis = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null,
});
const cacheService = new CacheService(redis);
const offersResolver = new OptimizedOffersResolver(prisma, cacheService);
const eligibilityService = new EligibilityService(prisma);

describe('Optimized Offers System', () => {
  beforeAll(async () => {
    // Clear cache before tests
    await redis.flushall();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await redis.quit();
  });

  describe('Query Offers', () => {
    test('should return offers for eligible user at specific outlet', async () => {
      const offers = await offersResolver.getOffers('user-123', 'outlet-001');

      expect(offers).toBeDefined();
      expect(Array.isArray(offers)).toBe(true);
      expect(offers.length).toBeGreaterThan(0);
      
      // Check offer structure
      const offer = offers[0];
      expect(offer).toHaveProperty('id');
      expect(offer).toHaveProperty('name');
      expect(offer).toHaveProperty('offerType');
      expect(offer.offerType).toBe('Cashback');
      expect(offer).toHaveProperty('merchantId');
    });

    test('should return empty array for non-eligible user', async () => {
      const offers = await offersResolver.getOffers('user-789', 'outlet-001');

      expect(offers).toBeDefined();
      expect(Array.isArray(offers)).toBe(true);
      expect(offers.length).toBe(0);
    });

    test('should return offers for user without outlet filter', async () => {
      const offers = await offersResolver.getOffers('user-123');

      expect(offers).toBeDefined();
      expect(Array.isArray(offers)).toBe(true);
      expect(offers.length).toBeGreaterThan(0);
    });

    test('should return empty array for non-existent user', async () => {
      const offers = await offersResolver.getOffers('user-nonexistent', 'outlet-001');

      expect(offers).toBeDefined();
      expect(Array.isArray(offers)).toBe(true);
      expect(offers.length).toBe(0);
    });
  });

  describe('Cache Performance', () => {
    test('should cache offers after first query', async () => {
      // Clear cache first
      await redis.flushall();

      // First query (cache miss)
      const start1 = Date.now();
      const offers1 = await offersResolver.getOffers('user-123', 'outlet-001');
      const time1 = Date.now() - start1;

      // Second query (cache hit)
      const start2 = Date.now();
      const offers2 = await offersResolver.getOffers('user-123', 'outlet-001');
      const time2 = Date.now() - start2;

      // Cache hit should be significantly faster
      expect(time2).toBeLessThan(time1);
      expect(offers1).toEqual(offers2);
    });
  });

  describe('Eligibility Service', () => {
    test('should compute eligibility for new cashback offer', async () => {
      // Create a test offer
      const testOffer = await prisma.cashbackConfiguration.create({
        data: {
          id: 'test-cashback-001',
          name: 'Test Cashback Offer',
          merchantId: 'merchant-001',
          eligibleCustomerTypes: ['Gold', 'Platinum'],
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          isActive: true,
          netCashbackBudget: 10000,
          usedCashbackBudget: 0,
        },
      });

      // Compute eligibility
      await eligibilityService.computeEligibility(
        testOffer.id,
        'Cashback',
        testOffer.merchantId
      );

      // Check eligibility records were created
      const eligibilityRecords = await prisma.userOfferEligibility.findMany({
        where: {
          offerId: testOffer.id,
          offerType: 'Cashback',
        },
      });

      expect(eligibilityRecords.length).toBeGreaterThan(0);
      expect(eligibilityRecords[0].isEligible).toBe(true);

      // Cleanup
      await prisma.userOfferEligibility.deleteMany({
        where: { offerId: testOffer.id },
      });
      await prisma.cashbackConfiguration.delete({
        where: { id: testOffer.id },
      });
    });

    test('should create eligibility records for all matching users and outlets', async () => {
      // Create test offer
      const testOffer = await prisma.cashbackConfiguration.create({
        data: {
          id: 'test-cashback-002',
          name: 'Test Multi-Outlet Offer',
          merchantId: 'merchant-001',
          eligibleCustomerTypes: ['Gold'],
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          isActive: true,
          netCashbackBudget: 10000,
          usedCashbackBudget: 0,
        },
      });

      await eligibilityService.computeEligibility(
        testOffer.id,
        'Cashback',
        testOffer.merchantId
      );

      const eligibilityRecords = await prisma.userOfferEligibility.findMany({
        where: {
          offerId: testOffer.id,
          offerType: 'Cashback',
        },
      });

      // Should create records for user-123 (Gold) at 2 outlets (outlet-001, outlet-002)
      expect(eligibilityRecords.length).toBeGreaterThanOrEqual(2);
      
      const userIds = [...new Set(eligibilityRecords.map(r => r.userId))];
      expect(userIds).toContain('user-123');

      // Cleanup
      await prisma.userOfferEligibility.deleteMany({
        where: { offerId: testOffer.id },
      });
      await prisma.cashbackConfiguration.delete({
        where: { id: testOffer.id },
      });
    });
  });

  describe('Performance Benchmarks', () => {
    test('query should complete in under 100ms (cache miss)', async () => {
      await redis.flushall();

      const start = Date.now();
      await offersResolver.getOffers('user-123', 'outlet-001');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });

    test('query should complete in under 10ms (cache hit)', async () => {
      // Warm up cache
      await offersResolver.getOffers('user-123', 'outlet-001');

      const start = Date.now();
      await offersResolver.getOffers('user-123', 'outlet-001');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10);
    });
  });

  describe('Data Integrity', () => {
    test('offers should have valid dates', async () => {
      const offers = await offersResolver.getOffers('user-123', 'outlet-001');

      offers.forEach(offer => {
        expect(new Date(offer.startDate)).toBeInstanceOf(Date);
        expect(new Date(offer.endDate)).toBeInstanceOf(Date);
        expect(new Date(offer.startDate).getTime()).toBeLessThan(
          new Date(offer.endDate).getTime()
        );
      });
    });

    test('offers should belong to correct merchant', async () => {
      const offers = await offersResolver.getOffers('user-123', 'outlet-001');

      offers.forEach(offer => {
        expect(offer.merchantId).toBe('merchant-001');
      });
    });

    test('offers should have required fields', async () => {
      const offers = await offersResolver.getOffers('user-123', 'outlet-001');

      offers.forEach(offer => {
        expect(offer.id).toBeTruthy();
        expect(offer.name).toBeTruthy();
        expect(offer.offerType).toBeTruthy();
        expect(offer.startDate).toBeTruthy();
        expect(offer.endDate).toBeTruthy();
        expect(offer.merchantId).toBeTruthy();
        expect(Array.isArray(offer.outlets)).toBe(true);
      });
    });
  });
});