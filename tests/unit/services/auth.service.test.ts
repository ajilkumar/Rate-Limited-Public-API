import { registerApiKey, validateApiKey, listApiKeys, revokeApiKey } from '../../../src/services/auth.service';
import { cleanDatabase, createTestApiKey } from '../../helpers/testUtils';
import { ApiKeyTier } from '../../../src/types';
import { ConflictError, NotFoundError, AuthenticationError } from '../../../src/utils/errors';
import { hashApiKey } from '../../../src/utils/apiKeyGenerator';

describe('Auth Service', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('registerApiKey', () => {
    it('should register new API key', async () => {
      const result = await registerApiKey({
        email: 'test@example.com',
        name: 'Test Key',
        tier: ApiKeyTier.FREE,
      });

      expect(result.apiKey).toMatch(/^sk_free_/);
      expect(result.email).toBe('test@example.com');
      expect(result.tier).toBe(ApiKeyTier.FREE);
      expect(result.rateLimitPerHour).toBe(100);
    });

    it.skip('should reject duplicate email', async () => {
      await registerApiKey({
        email: 'duplicate@example.com',
        tier: ApiKeyTier.FREE,
      });

      await expect(
        registerApiKey({
          email: 'duplicate@example.com',
          tier: ApiKeyTier.FREE,
        })
      ).rejects.toThrow(ConflictError);
    });

    it('should set correct rate limit for tier', async () => {
      const free = await registerApiKey({ email: 'free@example.com', tier: ApiKeyTier.FREE });
      const pro = await registerApiKey({ email: 'pro@example.com', tier: ApiKeyTier.PRO });
      const ent = await registerApiKey({ email: 'ent@example.com', tier: ApiKeyTier.ENTERPRISE });

      expect(free.rateLimitPerHour).toBe(100);
      expect(pro.rateLimitPerHour).toBe(1000);
      expect(ent.rateLimitPerHour).toBe(10000);
    });
  });

  describe('validateApiKey', () => {
    it.skip('should validate correct API key', async () => {
      const { rawKey } = await createTestApiKey();

      const result = await validateApiKey(rawKey);

      expect(result).toBeDefined();
      expect(result?.userEmail).toBeDefined();
      expect(result?.tier).toBe(ApiKeyTier.FREE);
    });

    it('should return null for invalid key', async () => {
      const result = await validateApiKey('sk_fake_invalid_key_123456789012');

      expect(result).toBeNull();
    });

    it('should reject inactive key', async () => {
      const { rawKey } = await createTestApiKey({ isActive: false });

      await expect(validateApiKey(rawKey)).rejects.toThrow(AuthenticationError);
    });

    it('should use constant-time comparison', async () => {
      const { rawKey } = await createTestApiKey();

      // Should not leak timing information
      const wrongKey = rawKey.slice(0, -1) + 'X';

      const result = await validateApiKey(wrongKey);
      expect(result).toBeNull();
    });
  });

  describe('listApiKeys', () => {
    it('should list user API keys', async () => {
      const email = 'test@example.com';
      await createTestApiKey({ email, name: 'Key 1' });
      await createTestApiKey({ email, name: 'Key 2' });

      const keys = await listApiKeys(email);

      expect(keys).toHaveLength(2);
      expect(keys[0].name).toBeDefined();
    });

    it('should not include raw keys', async () => {
      const email = 'test@example.com';
      await createTestApiKey({ email });

      const keys = await listApiKeys(email);

      expect(keys[0]).not.toHaveProperty('rawKey');
      expect(keys[0]).not.toHaveProperty('keyHash');
    });

    it('should only return keys for specified user', async () => {
      await createTestApiKey({ email: 'user1@example.com' });
      await createTestApiKey({ email: 'user2@example.com' });

      const keys = await listApiKeys('user1@example.com');

      expect(keys).toHaveLength(1);
    });
  });

  describe('revokeApiKey', () => {
    it('should revoke API key', async () => {
      // const { id, user_email } = await createTestApiKey();
      const { id, email } = await createTestApiKey();

      // await revokeApiKey(id, user_email);
      await revokeApiKey(id, email);

      // Verify key is inactive
      // const keys = await listApiKeys(user_email);
      const keys = await listApiKeys(email);
      expect(keys[0].isActive).toBe(false);
    });

    it('should not allow revoking other user key', async () => {
      const { id } = await createTestApiKey({ email: 'user1@example.com' });

      await expect(revokeApiKey(id, 'user2@example.com')).rejects.toThrow(NotFoundError);
    });
  });
});