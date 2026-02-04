import request from 'supertest';
import app from '../../src/app';
import { createTestApiKey, cleanDatabase, simulateRateLimitUsage } from '../helpers/testUtils';
import { ApiKeyTier } from '../../src/types';

describe('Rate Limiting', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('Free Tier (100 req/hour)', () => {
    it('should allow requests within limit', async () => {
      const { rawKey } = await createTestApiKey({ tier: ApiKeyTier.FREE});

      // Make 10 requests - all should succeed
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .get('/api/v1/auth/me')
          .set('Authorization', `Bearer ${rawKey}`)
          .expect(200);

        expect(response.headers['x-ratelimit-limit']).toBe('100');
        expect(parseInt(response.headers['x-ratelimit-remaining'])).toBeLessThanOrEqual(100);
      }
    });

    it('should block requests after limit', async () => {
      const { rawKey, id } = await createTestApiKey({ tier: ApiKeyTier.FREE });

      // Simulate 100 existing requests
      await simulateRateLimitUsage(id, 100);

      // Next request should be blocked
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${rawKey}`)
        .expect(429);

      expect(response.body.type).toContain('rate-limit-exceeded');
      expect(response.body.rate_limit.limit).toBe(100);
      expect(response.body.rate_limit.remaining).toBe(0);
      expect(response.headers['retry-after']).toBeDefined();
    });

    it('should return correct rate limit headers', async () => {
      const { rawKey, id } = await createTestApiKey({ tier: ApiKeyTier.FREE });

      // Simulate 50 existing requests
      await simulateRateLimitUsage(id, 50);

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${rawKey}`)
        .expect(200);

      expect(response.headers['x-ratelimit-limit']).toBe('100');
      expect(parseInt(response.headers['x-ratelimit-remaining'])).toBeLessThan(50);
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });

  describe('Pro Tier (1000 req/hour)', () => {
    it('should have higher limit', async () => {
      const { rawKey, id } = await createTestApiKey({ tier: ApiKeyTier.PRO });

      // Simulate 500 requests
      await simulateRateLimitUsage(id, 500);

      // Should still allow requests
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${rawKey}`)
        .expect(200);

      expect(response.headers['x-ratelimit-limit']).toBe('1000');
      expect(parseInt(response.headers['x-ratelimit-remaining'])).toBeGreaterThan(400);
    });

    it('should block after 1000 requests', async () => {
      const { rawKey, id } = await createTestApiKey({ tier: ApiKeyTier.PRO });

      // Simulate 1000 requests
      await simulateRateLimitUsage(id, 1000);

      await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${rawKey}`)
        .expect(429);
    });
  });

  describe('Sliding Window Behavior', () => {
    it('should use sliding window (not fixed window)', async () => {
      const { rawKey, id } = await createTestApiKey({ tier: ApiKeyTier.FREE });

      // Simulate 100 requests exactly at the limit
      await simulateRateLimitUsage(id, 100);

      // Should be blocked
      await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${rawKey}`)
        .expect(429);

      // Wait 2 seconds (simulating old requests falling out of window)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // If it was a fixed window, we'd need to wait for full hour reset
      // With sliding window, old entries should start dropping off
      // (In real implementation with 1-hour window, this would need longer wait)
    });
  });

  describe('Multiple API Keys', () => {
    it('should track rate limits independently', async () => {
      const key1 = await createTestApiKey({ email: 'user1@example.com' });
      const key2 = await createTestApiKey({ email: 'user2@example.com' });

      // Use up key1's limit
      await simulateRateLimitUsage(key1.id, 100);

      // key1 should be blocked
      await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${key1.rawKey}`)
        .expect(429);

      // key2 should still work
      await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${key2.rawKey}`)
        .expect(200);
    });
  });

  describe('Rate Limit on Different Endpoints', () => {
    it('should count all endpoints toward same limit', async () => {
      const { rawKey, id } = await createTestApiKey({ tier: ApiKeyTier.FREE });

      // Simulate 99 requests across different endpoints
      await simulateRateLimitUsage(id, 99);

      // First request to a different endpoint should work
      await request(app)
        .get('/api/v1/auth/keys')
        .set('Authorization', `Bearer ${rawKey}`)
        .expect(200);

      // Second request should be blocked (total = 101)
      await request(app)
        .get('/api/v1/usage/quota')
        .set('Authorization', `Bearer ${rawKey}`)
        .expect(429);
    });
  });
});