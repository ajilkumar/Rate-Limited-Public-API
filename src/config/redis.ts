import { createClient, RedisClientType } from 'redis';
import logger from './logger';

type RedisClient = RedisClientType;

const redisClient: RedisClient = createClient({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries: number) => {
      if (retries > 10) {
        logger.error('Redis max reconnection attempts reached');
        return new Error('Redis reconnection failed');
      }
      const delay = Math.min(retries * 100, 3000);
      logger.warn(`Redis reconnecting in ${delay}ms (attempt ${retries})`);
      return delay;
    },
  },
});

redisClient.on('connect', () => {
  logger.info('Redis client connecting...');
});

redisClient.on('ready', () => {
  logger.info('Redis client ready');
});

redisClient.on('error', (err: Error) => {
  logger.error('Redis client error', { error: err.message });
});

redisClient.on('end', () => {
  logger.info('Redis client disconnected');
});

export const connectRedis = async (): Promise<void> => {
  try {
    await redisClient.connect();
    logger.info('Redis connected successfully');
  } catch (error) {
    logger.error('Failed to connect to Redis', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};

export const closeRedis = async (): Promise<void> => {
  logger.info('Closing Redis connection...');
  await redisClient.quit();
  logger.info('Redis connection closed');
};

export const setex = async <T>(key: string, value: T, ttlSeconds: number): Promise<void> => {
  try {
    await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    logger.error('Redis setex error', {
      key,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};

export const get = async <T>(key: string): Promise<T | null> => {
  try {
    const value = await redisClient.get(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch (error) {
    logger.error('Redis get error', {
      key,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};

export { redisClient };