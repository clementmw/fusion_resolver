import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { eligibilityQueue } from '../workers/queus';

// Create Express adapter for Bull Board
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

// Create Bull Board
createBullBoard({
  queues: [
    new BullMQAdapter(eligibilityQueue),
    // Add more queues here as needed
  ],
  serverAdapter,
});

export { serverAdapter };