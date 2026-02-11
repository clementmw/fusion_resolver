import Redis from 'ioredis';

export class CacheService {
  private redis: Redis;
  private readonly TTL = 3600; // 1 hour

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, value: any, ttl: number = this.TTL): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }

  async invalidate(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  buildKey(userId: string, outletId?: string): string {
    return outletId 
      ? `offers:user:${userId}:outlet:${outletId}`
      : `offers:user:${userId}`;
  }
}