import 'dotenv/config';  
import {prisma} from '../src/services/scripts'
import { eligibilityQueue } from '../src/workers/queus';  

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Create Merchants
  const merchant1 = await prisma.merchant.upsert({
    where: { id: 'merchant-001' },
    update: {},
    create: {
      id: 'merchant-001',
      businessName: 'Starbucks Kenya',
      status: 'Active',
      category: 'Coffee & Tea',
    },
  });

  const merchant2 = await prisma.merchant.upsert({
    where: { id: 'merchant-002' },
    update: {},
    create: {
      id: 'merchant-002',
      businessName: 'Java House',
      status: 'Active',
      category: 'Restaurant',
    },
  });

  console.log('✅ Created merchants');

  // 2. Create Outlets
  const outlet1 = await prisma.outlet.upsert({
    where: { id: 'outlet-001' },
    update: {},
    create: {
      id: 'outlet-001',
      name: 'Starbucks Westlands',
      description: 'Premium coffee shop in Westlands',
      isActive: true,
      merchantId: merchant1.id,
    },
  });

  const outlet2 = await prisma.outlet.upsert({
    where: { id: 'outlet-002' },
    update: {},
    create: {
      id: 'outlet-002',
      name: 'Starbucks CBD',
      description: 'Downtown location',
      isActive: true,
      merchantId: merchant1.id,
    },
  });

  const outlet3 = await prisma.outlet.upsert({
    where: { id: 'outlet-003' },
    update: {},
    create: {
      id: 'outlet-003',
      name: 'Java House Sarit Centre',
      description: 'Family-friendly restaurant',
      isActive: true,
      merchantId: merchant2.id,
    },
  });

  console.log('✅ Created outlets');

  // 3. Create Customer Types (for testing eligibility)
const customerTypes = [
  { id: 'ct-001', userId: 'user-123', merchantId: merchant1.id, type: 'Gold' },
  { id: 'ct-002', userId: 'user-123', merchantId: merchant2.id, type: 'Platinum' },
  { id: 'ct-003', userId: 'user-456', merchantId: merchant1.id, type: 'Silver' },
  { id: 'ct-004', userId: 'user-789', merchantId: merchant1.id, type: 'Bronze' },
  { id: 'ct-005', userId: 'user-456', merchantId: merchant2.id, type: 'Silver' },
];

  for (const ct of customerTypes) {
    await prisma.customerType.upsert({
      where: { id: ct.id },
      update: {},
      create: ct,
    });
  }

  console.log('✅ Created customer types');

  // 4. Create Cashback Offers
  const cashback1 = await prisma.cashbackConfiguration.upsert({
    where: { id: 'cashback-001' },
    update: {},
    create: {
      id: 'cashback-001',
      name: '20% Cashback for Gold Members',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      isActive: true,
      eligibleCustomerTypes: ['Gold', 'Platinum', 'Diamond'],
      merchantId: merchant1.id,
      netCashbackBudget: 100000,
      usedCashbackBudget: 0,
      Outlets: {
        connect: [{ id: outlet1.id }, { id: outlet2.id }],
      },
    },
  });


  await eligibilityQueue.add('compute-eligibility', {
    offerChangeEvent: {
      eventType: 'created',
      offerType: 'Cashback',
      offerId: cashback1.id,
      merchantId: cashback1.merchantId,
      timestamp: new Date(),
    },
    priority: 'high',
    retryCount: 0,
  });
  console.log(`📤 Queued eligibility for: ${cashback1.name}`);

  const cashback2 = await prisma.cashbackConfiguration.upsert({
    where: { id: 'cashback-002' },
    update: {},
    create: {
      id: 'cashback-002',
      name: '10% Cashback for All',
      startDate: new Date('2026-02-01'),
      endDate: new Date('2026-06-30'),
      isActive: true,
      eligibleCustomerTypes: ['Bronze', 'Silver', 'Gold', 'Platinum'],
      merchantId: merchant2.id,
      netCashbackBudget: 50000,
      usedCashbackBudget: 5000,
      Outlets: {
        connect: [{ id: outlet3.id }],
      },
    },
  });

  // ✅ ADD THIS: Queue eligibility for cashback-002
  await eligibilityQueue.add('compute-eligibility', {
    offerChangeEvent: {
      eventType: 'created',
      offerType: 'Cashback',
      offerId: cashback2.id,
      merchantId: cashback2.merchantId,
      timestamp: new Date(),
    },
    priority: 'high',
    retryCount: 0,
  });
  console.log(`📤 Queued eligibility for: ${cashback2.name}`);

  console.log('✅ Created cashback offers');

  // 5. Create Exclusive Offers
  const exclusive1 = await prisma.exclusiveOffer.upsert({
    where: { id: 'exclusive-001' },
    update: {},
    create: {
      id: 'exclusive-001',
      name: 'Free Pastry with Coffee',
      description: 'Get a free pastry when you buy any large coffee',
      startDate: new Date('2026-02-01'),
      endDate: new Date('2026-02-28'),
      isActive: true,
      eligibleCustomerTypes: ['Platinum', 'Diamond'],
      merchantId: merchant1.id,
      netOfferBudget: 20000,
      usedOfferBudget: 1000,
      Outlets: {
        connect: [{ id: outlet1.id }],
      },
    },
  });

  await eligibilityQueue.add('compute-eligibility', {
    offerChangeEvent: {
      eventType: 'created',
      offerType: 'Exclusive',
      offerId: exclusive1.id,
      merchantId: exclusive1.merchantId!,
      timestamp: new Date(),
    },
    priority: 'high',
    retryCount: 0,
  });
  console.log(`📤 Queued eligibility for: ${exclusive1.name}`);

  console.log('✅ Created exclusive offers');

  // 6. Create Loyalty Program
  const loyaltyProgram = await prisma.loyaltyProgram.upsert({
    where: { id: 'loyalty-001' },
    update: {},
    create: {
      id: 'loyalty-001',
      name: 'Starbucks Rewards',
      isActive: true,
      merchantId: merchant1.id,
      pointsUsedInPeriod: 500,
      pointsIssuedLimit: 100000,
    },
  });

  // 7. Create Loyalty Tiers
  const tier1 = await prisma.loyaltyTier.upsert({
    where: { id: 'tier-001' },
    update: {},
    create: {
      id: 'tier-001',
      name: 'Gold Tier Rewards',
      isActive: true,
      minCustomerType: 'Gold',
      loyaltyProgramId: loyaltyProgram.id,
    },
  });

  console.log('✅ Created loyalty program and tiers');

  // 8. Create User Loyalty Points
  const userPoints = [
    { id: 'ulp-001', userId: 'user-123', points: 1500.0 },
    { id: 'ulp-002', userId: 'user-456', points: 750.5 },
    { id: 'ulp-003', userId: 'user-789', points: 250.0 },
  ];

  for (const up of userPoints) {
    await prisma.userLoyaltyPoints.upsert({
      where: { userId: up.userId },
      update: { points: up.points },
      create: up,
    });
  }

  console.log('✅ Created user loyalty points');

  console.log('🎉 Seed completed successfully!');
  console.log('\n⏳ Wait 5-10 seconds for background worker to compute eligibility...');
  console.log('\n📊 Summary:');
  console.log(`- Merchants: 2`);
  console.log(`- Outlets: 3`);
  console.log(`- Customer Types: 4`);
  console.log(`- Cashback Offers: 2`);
  console.log(`- Exclusive Offers: 1`);
  console.log(`- Loyalty Programs: 1`);
  console.log(`- User Loyalty Points: 3`);
  console.log('\n🧪 Test Data:');
  console.log(`- User ID: user-123 (Gold at Starbucks, Platinum at Java House, 1500 points)`);
  console.log(`- User ID: user-456 (Silver at Starbucks, 750.5 points)`);
  console.log(`- User ID: user-789 (Bronze at Starbucks, 250 points)`);
  console.log(`- Outlet ID: outlet-001 (Starbucks Westlands)`);
  console.log(`- Merchant ID: merchant-001 (Starbucks Kenya)`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });