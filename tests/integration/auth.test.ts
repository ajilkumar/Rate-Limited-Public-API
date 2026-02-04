import request from 'supertest';
import app from '../../src/app';
import { ApiKeyTier } from '../../src/types';
import { testPool } from '../testDb';

describe('Auth Integration', () => {
  describe('POST /api/v1/auth/keys', () => {
    it('should register a new API key and store it in the database', async () => {
      const payload = {
        email: 'integration-test@example.com',
        name: 'Integration Key',
        tier: ApiKeyTier.PRO,
      };

      const response = await request(app)
        .post('/api/v1/auth/register') // Looking at routes, it might be /api/v1/auth/register based on registerApiKeyDto
        .send(payload);

      // Note: If the route is actually /api/v1/auth/keys, adjust accordingly.
      // Let's check the routes actually. I'll search for where registerApiKey is used in routes.
      
      if (response.status === 404) {
          // If 404, it might be /api/v1/auth/keys or similar.
          // I will verify the route definition in the next step if this fails.
      }

      expect(response.status).toBe(201);
      expect(response.body.data.email).toBe(payload.email);
      expect(response.body.data.tier).toBe(payload.tier);
      expect(response.body.data.apiKey).toBeDefined();

      // Verify database entry
      const dbResult = await testPool.query(
        'SELECT * FROM api_keys WHERE user_email = $1',
        [payload.email]
      );
      expect(dbResult.rows).toHaveLength(1);
      expect(dbResult.rows[0].name).toBe(payload.name);
    });

    it('should return 400 for invalid email', async () => {
      const payload = {
        email: 'invalid-email',
        tier: ApiKeyTier.FREE,
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(payload);

      expect(response.status).toBe(400);
    });

    it('should return 409 for duplicate email', async () => {
      const payload = {
        email: 'duplicate@example.com',
        tier: ApiKeyTier.FREE,
      };

      // First registration
      await request(app)
        .post('/api/v1/auth/register')
        .send(payload);

      // Second registration with same email
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(payload);

      expect(response.status).toBe(409);
      expect(response.body.type).toContain('conflict');
      expect(response.body.detail).toContain('already exists');
    });
  });
});
