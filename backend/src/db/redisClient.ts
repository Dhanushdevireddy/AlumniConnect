import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl);
export const redisSub = new Redis(redisUrl); // separate connection for subscriptions
export const redisPub = new Redis(redisUrl); // separate connection for publishing

redis.on('connect', () => console.log('[Redis] Connected'));
redis.on('error', (err) => console.error('[Redis] Error:', err));

export default redis;
