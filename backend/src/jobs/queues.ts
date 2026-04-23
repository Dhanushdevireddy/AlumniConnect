import { Queue } from 'bullmq';
import { redis } from '../db/redisClient';

const connection = { host: redis.options.host || 'localhost', port: redis.options.port || 6379 };

export const sessionJobQueue = new Queue('session-jobs', { connection });
export const digestJobQueue = new Queue('digest-jobs', { connection });
export const healthJobQueue = new Queue('health-jobs', { connection });
export const rankingJobQueue = new Queue('ranking-jobs', { connection });

console.log('[BullMQ] Queues initialized');
