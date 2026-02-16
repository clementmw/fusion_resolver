
// seed for a scenario you want to alot of data
import 'dotenv/config';
import { prisma } from '../src/services/scripts';
import { eligibilityQueue } from '../src/workers/queus';

const MERCHANT_COUNT = 5;
const USERS_COUNT = 100;
const OUTLETS_PER_MERCHANT = 4;
const OFFERS_PER_MERCHANT = 2;

const CUSTOMER_TYPES = ['Bronze', 'Silver', 'Gold', 'Platinum'];

async function main() {
  console.log('Starting database seed...');

  // 1. Create Users (implicit via customer types + loyalty points)
  const users = Array.from({ length: USERS_COUNT }, (_, i) => ({
    id: `user-${String(i + 1).padStart(3, '0')}`,
  }));

  // 2. Create Merchants
  const merchants = [];

  for (let i = 0; i < MERCHANT_COUNT; i++) {
    const merchant = await prisma.merchant.upsert({
      where: { id: `merchant-${String(i + 1).padStart(3, '0')}` },
      update: {},
      create: {
        id: `merchant-${String(i + 1).padStart(3, '0')}`,
        businessName: `Merchant ${i + 1}`,
        status: 'Active',
        category: 'General',
      },
    });

    merchants.push(merchant);
  }

  console.log(`Created ${MERCHANT_COUNT} merchants`);

  // 3. Create Outlets
  const outlets = [];

  for (const merchant of merchants) {
    for (let i = 0; i < OUTLETS_PER_MERCHANT; i++) {
      const outlet = await prisma.outlet.upsert({
        where: { id: `${merchant.id}-outlet-${i + 1}` },
        update: {},
        create: {
          id: `${merchant.id}-outlet-${i + 1}`,
          name: `Outlet ${i + 1} - ${merchant.businessName}`,
          description: `Outlet ${i + 1}`,
          isActive: true,
          merchantId: merchant.id,
        },
      });

      outlets.push(outlet);
    }
  }

  console.log(`Created ${MERCHANT_COUNT * OUTLETS_PER_MERCHANT} outlets`);

  // 4. Create Customer Types (100 users across 5 merchants)
  let customerTypeId = 1;

  for (const user of users) {
    for (const merchant of merchants) {
      const randomType =
        CUSTOMER_TYPES[Math.floor(Math.random() * CUSTOMER_TYPES.length)];

      await prisma.customerType.upsert({
        where: { id: `ct-${customerTypeId}` },
        update: {},
        create: {
          id: `ct-${customerTypeId}`,
          userId: user.id,
          merchantId: merchant.id,
          type: randomType,
        },
      });

      customerTypeId++;
    }
  }

  console.log(`Created ${USERS_COUNT * MERCHANT_COUNT} customer types`);

  // 5. Create Offers Per Merchant
  for (const merchant of merchants) {
    const merchantOutlets = outlets.filter(
      (o) => o.merchantId === merchant.id
    );

    for (let i = 0; i < OFFERS_PER_MERCHANT; i++) {
      const offerId = `${merchant.id}-cashback-${i + 1}`;

      const cashback = await prisma.cashbackConfiguration.upsert({
        where: { id: offerId },
        update: {},
        create: {
          id: offerId,
          name: `Cashback Offer ${i + 1} - ${merchant.businessName}`,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          isActive: true,
          eligibleCustomerTypes: ['Gold', 'Platinum'],
          merchantId: merchant.id,
          netCashbackBudget: 100000,
          usedCashbackBudget: 0,
          Outlets: {
            connect: merchantOutlets.map((o) => ({ id: o.id })),
          },
        },
      });

      await eligibilityQueue.add('compute-eligibility', {
        offerChangeEvent: {
          eventType: 'created',
          offerType: 'CASHBACK',
          offerId: cashback.id,
          merchantId: cashback.merchantId,
          timestamp: new Date(),
        },
        priority: 'high',
        retryCount: 0,
      });
    }
  }

  console.log(
    `Created ${MERCHANT_COUNT * OFFERS_PER_MERCHANT} cashback offers`
  );

  // 6. Loyalty Programs (1 per merchant)
  for (const merchant of merchants) {
    const loyalty = await prisma.loyaltyProgram.upsert({
      where: { id: `${merchant.id}-loyalty` },
      update: {},
      create: {
        id: `${merchant.id}-loyalty`,
        name: `Rewards - ${merchant.businessName}`,
        isActive: true,
        merchantId: merchant.id,
        pointsUsedInPeriod: 0,
        pointsIssuedLimit: 100000,
      },
    });

    await prisma.loyaltyTier.upsert({
      where: { id: `${loyalty.id}-tier-1` },
      update: {},
      create: {
        id: `${loyalty.id}-tier-1`,
        name: 'Gold Tier',
        isActive: true,
        minCustomerType: 'Gold',
        loyaltyProgramId: loyalty.id,
      },
    });
  }

  console.log(`Created ${MERCHANT_COUNT} loyalty programs`);

  // 7. User Loyalty Points
  for (const user of users) {
    await prisma.userLoyaltyPoints.upsert({
      where: { userId: user.id },
      update: { points: Math.floor(Math.random() * 5000) },
      create: {
        id: `ulp-${user.id}`,
        userId: user.id,
        points: Math.floor(Math.random() * 5000),
      },
    });
  }

  console.log(`Created ${USERS_COUNT} user loyalty records`);

  console.log('Seed completed successfully');
  console.log('Wait for background worker to compute eligibility');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
