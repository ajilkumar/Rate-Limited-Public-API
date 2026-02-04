import request from 'supertest';
import app from '../../src/app';
import { createTestApiKey, createTestUsageLogs, cleanDatabase } from '../helpers/testUtils';
import { ApiKeyTier } from '../../src/types';

describe('Usage Endpoints', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('GET /api/v1/usage/stats', () => {
    it('should return usage statistics', async () => {
      const { rawKey, id: apiKeyId } = await createTestApiKey();
      await createTestUsageLogs(apiKeyId, 10);

      const response = await request(app)
        .get('/api/v1/usage/stats?period=30d')
        .set('Authorization', `Bearer ${rawKey}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.period).toBe('30d');
      expect(response.body.data.totalRequests).toBeGreaterThan(0);
      expect(response.body.data.successfulRequests).toBeGreaterThan(0);
      expect(response.body.data.requestsByEndpoint).toBeDefined();
    });

    it('should support different time periods', async () => {
      const { rawKey, id: apiKeyId } = await createTestApiKey();
      await createTestUsageLogs(apiKeyId, 5);

      const periods = ['24h', '7d', '30d'];

      for (const period of periods) {
        const response = await request(app)
          .get(`/api/v1/usage/stats?period=${period}`)
          .set('Authorization', `Bearer ${rawKey}`)
          .expect(200);

        expect(response.body.data.period).toBe(period);
      }
    });

    it('should only show stats for authenticated user', async () => {
      const user1 = await createTestApiKey({ email: 'user1@example.com' });
      const user2 = await createTestApiKey({ email: 'user2@example.com' });

      await createTestUsageLogs(user1.id, 5);
      await createTestUsageLogs(user2.id, 10);

      const response = await request(app)
        .get('/api/v1/usage/stats?period=30d')
        .set('Authorization', `Bearer ${user1.rawKey}`)
        .expect(200);

      // Should only count user1's requests (5 logs + this request = 6)
      expect(response.body.data.totalRequests).toBeLessThan(10);
    });
  });

  describe('GET /api/v1/usage/quota', () => {
    it('should return quota information', async () => {
      const { rawKey } = await createTestApiKey({ tier: ApiKeyTier.FREE });

      const response = await request(app)
        .get('/api/v1/usage/quota')
        .set('Authorization', `Bearer ${rawKey}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.quotaLimit).toBe(100);
      expect(response.body.data.remainingQuota).toBeLessThanOrEqual(100);
      expect(response.body.data.topEndpoints).toBeDefined();
    });

    it('should show different quota for different tiers', async () => {
      const freeUser = await createTestApiKey({ tier: ApiKeyTier.FREE });
      const proUser = await createTestApiKey({ tier: ApiKeyTier.PRO });

      const freeResponse = await request(app)
        .get('/api/v1/usage/quota')
        .set('Authorization', `Bearer ${freeUser.rawKey}`)
        .expect(200);

      const proResponse = await request(app)
        .get('/api/v1/usage/quota')
        .set('Authorization', `Bearer ${proUser.rawKey}`)
        .expect(200);

      expect(freeResponse.body.data.quotaLimit).toBe(100);
      expect(proResponse.body.data.quotaLimit).toBe(1000);
    });
  });
});