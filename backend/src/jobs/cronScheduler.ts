import { Queue } from 'bullmq';
import redis from '../db/redisClient';

const connection = { host: redis.options.host || 'localhost', port: redis.options.port || 6379 };

export function setupCronJobs() {
  const digestQueue = new Queue('digest-jobs', { connection });
  const healthQueue = new Queue('health-jobs', { connection });

  // digest-daily: runs every day at 8:00 AM
  digestQueue.add('digest-daily', {}, {
    repeat: { pattern: '0 8 * * *' },
    attempts: 3,
    backoff: { type: 'exponential', delay: 10000 },
  });

  // digest-weekly: runs every Monday at 9:00 AM
  digestQueue.add('digest-weekly', {}, {
    repeat: { pattern: '0 9 * * 1' },
    attempts: 3,
    backoff: { type: 'exponential', delay: 10000 },
  });

  // health-score-recalc: runs every hour
  healthQueue.add('health-score-recalc', {}, {
    repeat: { pattern: '0 * * * *' },
    attempts: 3,
    backoff: { type: 'exponential', delay: 15000 },
  });

  console.log('[Cron] Digest jobs (daily + weekly) and health-score-recalc scheduled');
}
