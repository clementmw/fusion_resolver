import { Worker, Job } from 'bullmq';
import { EligibilityService } from '../services/EligibilityService';
import { CacheService } from '../services/CacheService';
import { redisConnection } from './queus';

interface EligibilityJobData {
  offerChangeEvent: {
    eventType: 'created' | 'updated' | 'deleted';
    offerType: 'Cashback' | 'Exclusive' | 'Loyalty';
    offerId: string;
    merchantId: string;
    timestamp: Date;
  };
  priority: 'high' | 'low';
  retryCount: number;
}

export class EligibilityWorker {
  private worker: Worker;

  constructor(
    private eligibilityService: EligibilityService,
    private cacheService: CacheService
  ) {
    this.worker = new Worker(
      'offer-eligibility',
      async (job: Job<EligibilityJobData>) => {
        await this.processJob(job);
      },
      {
        connection: redisConnection,
        concurrency: 5, // Process 5 jobs concurrently but can be increased as needed
      }
    );

    this.worker.on('completed', (job) => {
      console.log(` Job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(` Job ${job?.id} failed:`, err);
    });
  }

  private async processJob(job: Job<EligibilityJobData>): Promise<void> {
    const { offerChangeEvent } = job.data;
    
    console.log(`Processing eligibility for offer: ${offerChangeEvent.offerId}`);

    // Compute eligibility
    await this.eligibilityService.computeEligibility(
      offerChangeEvent.offerId,
      offerChangeEvent.offerType,
      offerChangeEvent.merchantId
    );

    // Invalidate cache for affected users
    await this.cacheService.invalidate(`offers:*:merchant:${offerChangeEvent.merchantId}`);
    
    console.log(`Cache invalidated for merchant: ${offerChangeEvent.merchantId}`);
  }

  async start(): Promise<void> {
    console.log('Eligibility Worker started');
  }

  async stop(): Promise<void> {
    await this.worker.close();
    console.log('Eligibility Worker stopped');
  }
}