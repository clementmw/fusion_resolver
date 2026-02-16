// tests/load/two_phase_stress_test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const steadyStateLatency = new Trend('steady_state_latency');
const cacheHitRate = new Rate('cache_hits');

const USER_COUNT = 100;
const MERCHANT_COUNT = 5;
const OUTLETS_PER_MERCHANT = 4;

export const options = {
  scenarios: {
    // PHASE 1: Warm-up - Create offers and populate cache
    warmup: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },  // Gradual ramp
        { duration: '1m', target: 50 },   // Peak write load
        { duration: '30s', target: 0 },   // Wind down
      ],
      gracefulRampDown: '10s',
      startTime: '0s',
      tags: { phase: 'warmup' },
    },

    // PHASE 2: Steady State - Pure reads (cache hits)
    steady_state: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },   // Ramp up
        { duration: '2m', target: 100 },   // Moderate load
        { duration: '2m', target: 150 },   // High load
        { duration: '1m', target: 200 },   // Peak load
        { duration: '30s', target: 0 },    // Wind down
      ],
      gracefulRampDown: '10s',
      startTime: '2m30s', // ⭐ Start AFTER warmup completes + buffer
      tags: { phase: 'steady_state' },
    },
  },

  thresholds: {
    // Warmup phase - lenient thresholds
    'http_req_duration{phase:warmup}': ['p(95)<2000'], // 2s acceptable during cache population

    // Steady state - strict thresholds (this is what matters!)
    'http_req_duration{phase:steady_state}': [
      'p(50)<100',   // Median < 100ms
      'p(95)<200',   // P95 < 200ms
      'p(99)<500',   // P99 < 500ms
    ],
    
    'errors{phase:steady_state}': ['rate<0.01'], // < 1% errors in steady state
    'http_req_failed{phase:steady_state}': ['rate<0.005'], // < 0.5% failures
    
    // Cache performance
    'cache_hits': ['rate>0.95'], // > 95% cache hit rate overall
  },
};

const BASE_URL = 'http://localhost:4000/graphql';

// Dynamic ID generators
function randomUserId() {
  const n = Math.floor(Math.random() * USER_COUNT) + 1;
  return `user-${String(n).padStart(3, '0')}`;
}

function randomMerchantId() {
  const n = Math.floor(Math.random() * MERCHANT_COUNT) + 1;
  return `merchant-${String(n).padStart(3, '0')}`;
}

function randomOutletId(merchantId) {
  const n = Math.floor(Math.random() * OUTLETS_PER_MERCHANT) + 1;
  return `${merchantId}-outlet-${n}`;
}

export default function () {
  const headers = { 'Content-Type': 'application/json' };
  const phase = __ENV.SCENARIO || 'warmup';

  if (phase === 'warmup') {
    // PHASE 1: Mix of reads and writes
    warmupPhase(headers);
  } else {
    // PHASE 2: Pure reads only
    steadyStatePhase(headers);
  }
}

function warmupPhase(headers) {
  const trafficType = Math.random();

  // 50% Reads, 50% Writes (aggressive cache population)
  if (trafficType < 0.5) {
    queryOffers(headers, false); // Don't track cache hits yet
  } else {
    createOffer(headers);
  }

  sleep(1); // Standard think time
}

function steadyStatePhase(headers) {
  const trafficType = Math.random();

  // 95% Reads, 5% occasional writes (realistic production)
  if (trafficType < 0.95) {
    const startTime = Date.now();
    const cacheHit = queryOffers(headers, true); // Track cache hits
    const duration = Date.now() - startTime;
    
    steadyStateLatency.add(duration);
    cacheHitRate.add(cacheHit ? 1 : 0);
  } else {
    // Occasional new offer creation
    createOffer(headers);
  }

  sleep(0.5); // More aggressive - users browse quickly
}

function queryOffers(headers, trackCache = false) {
  const userId = randomUserId();
  const merchantId = randomMerchantId();
  const outletId = Math.random() < 0.3 ? randomOutletId(merchantId) : null;
  const offerType = Math.random() < 0.2 ? 'Cashback' : null;

  let queryStr = `query GetOffers($userId: String!`;
  let variablesObj = { userId };

  if (outletId) {
    queryStr += `, $outletId: String`;
    variablesObj.outletId = outletId;
  }
  if (offerType) {
    queryStr += `, $offerType: String`;
    variablesObj.offerType = offerType;
  }

  queryStr += `) {
    offers(userId: $userId`;
  if (outletId) queryStr += `, outletId: $outletId`;
  if (offerType) queryStr += `, offerType: $offerType`;
  queryStr += `) {
      id
      name
      offerType
      merchantId
      validFrom
      validUntil
    }
  }`;

  const res = http.post(
    BASE_URL,
    JSON.stringify({ query: queryStr, variables: variablesObj }),
    { headers, tags: { operation: 'query_offers' } }
  );

  const success = check(res, {
    'read status 200': (r) => r.status === 200,
    'no read errors': (r) => !r.json('errors'),
    'has data': (r) => r.json('data.offers') !== undefined,
  });

  if (!success) errorRate.add(1);

  // ⭐ Detect cache hit (fast response = cache hit)
  const isCacheHit = res.timings.duration < 150; // < 150ms = cache hit
  
  return isCacheHit;
}

function createOffer(headers) {
  const merchantId = randomMerchantId();
  const outletId = randomOutletId(merchantId);

  const payload = JSON.stringify({
    query: `
      mutation CreateOffer($input: CreateOfferInput!) {
        createOffer(input: $input) {
          id
          merchantId
        }
      }
    `,
    variables: {
      input: {
        name: `Load Test Offer ${__VU}-${Date.now()}`,
        offerType: 'CASHBACK',
        merchantId: merchantId,
        eligibleCustomerTypes: ['Gold', 'Platinum'],
        startDate: '2026-01-01T00:00:00Z',
        endDate: '2026-12-31T23:59:59Z',
        outletIds: [outletId],
        netCashbackBudget: 10000,
      },
    },
  });

  const res = http.post(BASE_URL, payload, {
    headers,
    tags: { operation: 'create_offer' },
  });

  const success = check(res, {
    'create status 200': (r) => r.status === 200,
    'no create errors': (r) => !r.json('errors'),
  });

  if (!success) errorRate.add(1);
}

export function handleSummary(data) {
  console.log('\n' + '='.repeat(70));
  console.log('📊 TWO-PHASE LOAD TEST RESULTS');
  console.log('='.repeat(70));

  // Overall stats
  console.log('\n📈 OVERALL METRICS:');
  console.log(`   Total Requests: ${data.metrics.http_reqs.values.count}`);
  console.log(`   Overall Error Rate: ${(data.metrics.errors?.values.rate || 0) * 100}%`);

  // Warmup phase
  if (data.metrics['http_req_duration{phase:warmup}']) {
    console.log('\n🔥 PHASE 1: WARMUP (Cache Population)');
    const warmup = data.metrics['http_req_duration{phase:warmup}'].values;
    console.log(`   Requests: ${data.metrics['http_reqs{phase:warmup}']?.values.count || 'N/A'}`);
    console.log(`   Median: ${warmup.med.toFixed(2)}ms`);
    console.log(`   P95: ${warmup['p(95)'].toFixed(2)}ms`);
    console.log(`   P99: ${warmup['p(99)'] || 'N/A'}ms`);
    console.log(`   ℹ️  High latency expected during cache population`);
  }

  // Steady state phase
  if (data.metrics['http_req_duration{phase:steady_state}']) {
    console.log('\n🚀 PHASE 2: STEADY STATE (Production Performance)');
    const steady = data.metrics['http_req_duration{phase:steady_state}'].values;
    console.log(`   Requests: ${data.metrics['http_reqs{phase:steady_state}']?.values.count || 'N/A'}`);
    console.log(`   Median: ${steady.med.toFixed(2)}ms ⭐`);
    console.log(`   P95: ${steady['p(95)'].toFixed(2)}ms ⭐`);
    console.log(`   P99: ${steady['p(99)'] || 'N/A'}ms ⭐`);
    console.log(`   Max: ${steady.max.toFixed(2)}ms`);

    // Error rates
    const steadyErrors = data.metrics['errors{phase:steady_state}']?.values.rate || 0;
    console.log(`   Error Rate: ${(steadyErrors * 100).toFixed(2)}%`);

    // Performance verdict
    console.log('\n🎯 PERFORMANCE VERDICT:');
    if (steady.med < 100 && steady['p(95)'] < 200) {
      console.log('   ✅ EXCELLENT - System performs well under load');
    } else if (steady.med < 200 && steady['p(95)'] < 500) {
      console.log('   ⚠️  ACCEPTABLE - Some optimization needed');
    } else {
      console.log('   ❌ POOR - Significant optimization required');
    }
  }

  // Cache performance
  if (data.metrics.cache_hits) {
    console.log('\n💾 CACHE PERFORMANCE:');
    const cacheRate = data.metrics.cache_hits.values.rate;
    console.log(`   Cache Hit Rate: ${(cacheRate * 100).toFixed(2)}%`);
    
    if (cacheRate > 0.95) {
      console.log('   ✅ Excellent cache performance');
    } else if (cacheRate > 0.80) {
      console.log('   ⚠️  Cache could be improved');
    } else {
      console.log('   ❌ Poor cache performance');
    }
  }

  console.log('\n' + '='.repeat(70));

  return {
    'stdout': JSON.stringify(data, null, 2),
    'summary.json': JSON.stringify(data),
  };
}