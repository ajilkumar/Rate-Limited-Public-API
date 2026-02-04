import request from 'supertest';
import app from '../../src/app';
import { createTestApiKey, cleanDatabase } from '../helpers/testUtils';

describe('Auth Endpoints', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register new API key', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          name: 'Test Key',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.apiKey).toMatch(/^sk_free_/);
      expect(response.body.data.email).toBe('test@example.com');
      expect(response.body.data.tier).toBe('free');
      expect(response.body.data.rateLimitPerHour).toBe(100);
    });

    it('should register pro tier key', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'pro@example.com',
          tier: 'pro',
        })
        .expect(201);

      expect(response.body.data.apiKey).toMatch(/^sk_pro_/);
      expect(response.body.data.rateLimitPerHour).toBe(1000);
    });

    it('should reject invalid email', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'invalid-email',
        })
        .expect(400);
    });

    it('should reject duplicate email', async () => {
      const email = 'duplicate@example.com';

      // Register once
      await request(app)
        .post('/api/v1/auth/register')
        .send({ email })
        .expect(201);

      // Try again
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ email })
        .expect(409);

      expect(response.body.type).toContain('conflict');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return current user info', async () => {
      const { rawKey } = await createTestApiKey({ email: 'test@example.com' });

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${rawKey}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('test@example.com');
      expect(response.body.data.tier).toBe('free');
    });

    it('should reject missing API key', async () => {
      await request(app)
        .get('/api/v1/auth/me')
        .expect(401);
    });

    it('should reject invalid API key', async () => {
      await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer sk_fake_invalid_key_here_12345')
        .expect(401);
    });

    it('should reject inactive API key', async () => {
      const { rawKey } = await createTestApiKey({ isActive: false });

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${rawKey}`)
        .expect(401);

      expect(response.body.detail).toContain('deactivated');
    });
  });

  describe('GET /api/v1/auth/keys', () => {
    it('should list user API keys', async () => {
      const { rawKey } = await createTestApiKey({ email: 'test@example.com' });
      await createTestApiKey({ email: 'test@example.com', name: 'Second Key' });

      const response = await request(app)
        .get('/api/v1/auth/keys')
        .set('Authorization', `Bearer ${rawKey}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.keys).toHaveLength(2);
      expect(response.body.data.total).toBe(2);
    });

    it('should only show keys for authenticated user', async () => {
      const { rawKey } = await createTestApiKey({ email: 'user1@example.com' });
      await createTestApiKey({ email: 'user2@example.com' });

      const response = await request(app)
        .get('/api/v1/auth/keys')
        .set('Authorization', `Bearer ${rawKey}`)
        .expect(200);

      expect(response.body.data.keys).toHaveLength(1);
    });
  });
});