import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, RateLimitInfo } from '../types';
import { RateLimitError, AuthenticationError } from '../utils/errors';
import { redisClient } from '../config/redis';
import { REDIS_KEYS } from '../utils/constants';
import logger from '../config/logger';
import crypto from 'crypto';

/**
 * Rate limiting middleware using sliding window algorithm
 * Must be used AFTER authentication middleware
 */
export const rateLimiter = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Ensure user is authenticated
    if (!req.apiKey) {
      throw new AuthenticationError('Authentication required for rate limiting');
    }

    const apiKeyId = req.apiKey.id;
    const limit = req.apiKey.rateLimitPerHour;
    const windowMs = 3600000; // 1 hour in milliseconds

    // Check rate limit
    const rateLimitInfo = await checkRateLimit(apiKeyId, limit, windowMs);

    // Attach rate limit info to request
    req.rateLimit = rateLimitInfo;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', rateLimitInfo.limit.toString());
    res.setHeader('X-RateLimit-Remaining', rateLimitInfo.remaining.toString());
    res.setHeader('X-RateLimit-Reset', rateLimitInfo.reset.toString());

    logger.debug('Rate limit check passed', {
      apiKeyId,
      remaining: rateLimitInfo.remaining,
      limit: rateLimitInfo.limit,
    });

    next();
  } catch (error) {
    // Add Retry-After header for rate limit errors
    if (error instanceof RateLimitError) {
      res.setHeader('Retry-After', error.rateLimit.retryAfter.toString());
      res.setHeader('X-RateLimit-Limit', error.rateLimit.limit.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', error.rateLimit.reset.toString());
    }
    next(error);
  }
};

/**
 * Check rate limit using Redis sorted set
 * Implements sliding window algorithm
 */
const checkRateLimit = async (
  apiKeyId: string,
  limit: number,
  windowMs: number
): Promise<RateLimitInfo> => {
  const now = Date.now();
  const windowStart = now - windowMs;
  const key = REDIS_KEYS.RATE_LIMIT(apiKeyId);

  try {
    // Use Lua script for atomic operations
    const luaScript = `
      local key = KEYS[1]
      local now = tonumber(ARGV[1])
      local windowStart = tonumber(ARGV[2])
      local limit = tonumber(ARGV[3])
      local requestId = ARGV[4]
      local windowMs = tonumber(ARGV[5])
      
      -- Remove old entries outside the window
      redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)
      
      -- Count current entries in window
      local count = redis.call('ZCARD', key)
      
      -- Check if limit exceeded
      if count >= limit then
        -- Get oldest entry to calculate reset time
        local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
        local resetTime = 0
        if #oldest > 0 then
          resetTime = tonumber(oldest[2]) + windowMs
        end
        return {0, count, resetTime}
      end
      
      -- Add current request
      redis.call('ZADD', key, now, requestId)
      
      -- Set expiration (cleanup)
      redis.call('EXPIRE', key, math.ceil(windowMs / 1000))
      
      return {1, count + 1, now + windowMs}
    `;

    const requestId = crypto.randomUUID();

    // Execute Lua script
    const result = (await redisClient.eval(luaScript, {
      keys: [key],
      arguments: [
        now.toString(),
        windowStart.toString(),
        limit.toString(),
        requestId,
        windowMs.toString(),
      ],
    })) as [number, number, number];

    const [allowed, count, resetTime] = result;

    if (allowed === 0) {
      // Rate limit exceeded
      const retryAfter = Math.ceil((resetTime - now) / 1000);
      throw new RateLimitError(limit, Math.ceil(resetTime / 1000), retryAfter);
    }

    // Rate limit check passed
    return {
      limit,
      remaining: limit - count,
      reset: Math.ceil(resetTime / 1000),
    };
  } catch (error) {
    // If Redis error, log and allow request (fail open)
    if (!(error instanceof RateLimitError)) {
      logger.error('Rate limit check failed (Redis error)', {
        apiKeyId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Return permissive rate limit info
      return {
        limit,
        remaining: limit,
        reset: Math.ceil((now + windowMs) / 1000),
      };
    }

    throw error;
  }
};

/**
 * Get current rate limit status without incrementing
 */
export const getRateLimitStatus = async (
  apiKeyId: string,
  limit: number,
  windowMs: number
): Promise<RateLimitInfo> => {
  const now = Date.now();
  const windowStart = now - windowMs;
  const key = REDIS_KEYS.RATE_LIMIT(apiKeyId);

  try {
    // Remove old entries
    await redisClient.zRemRangeByScore(key, '-inf', windowStart);

    // Count current entries
    const count = await redisClient.zCard(key);

    // Get oldest entry for reset time
    const oldest = await redisClient.zRange(key, 0, 0, { REV: false, BY: 'SCORE' });
    const resetTime = oldest.length > 0 ? parseInt(oldest[0]!) + windowMs : now + windowMs;

    return {
      limit,
      remaining: Math.max(0, limit - count),
      reset: Math.ceil(resetTime / 1000),
    };
  } catch (error) {
    logger.error('Failed to get rate limit status', {
      apiKeyId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      limit,
      remaining: limit,
      reset: Math.ceil((now + windowMs) / 1000),
    };
  }
};
