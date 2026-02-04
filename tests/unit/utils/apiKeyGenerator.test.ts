import {
  generateApiKey,
  hashApiKey,
  extractKeyPrefix,
  isValidApiKeyFormat,
  extractTierFromKey,
  constantTimeCompare,
  maskApiKey,
} from '../../../src/utils/apiKeyGenerator';
import { ApiKeyTier } from '../../../src/types';

describe('API Key Generator', () => {
  describe('generateApiKey', () => {
    it('should generate valid free tier key', () => {
      const key = generateApiKey(ApiKeyTier.FREE);
      expect(key).toMatch(/^sk_free_[A-Za-z0-9]{24}$/);
    });

    it('should generate valid pro tier key', () => {
      const key = generateApiKey(ApiKeyTier.PRO);
      expect(key).toMatch(/^sk_pro_[A-Za-z0-9]{24}$/);
    });

    it('should generate valid enterprise tier key', () => {
      const key = generateApiKey(ApiKeyTier.ENTERPRISE);
      expect(key).toMatch(/^sk_ent_[A-Za-z0-9]{24}$/);
    });

    it('should generate unique keys', () => {
      const key1 = generateApiKey(ApiKeyTier.FREE);
      const key2 = generateApiKey(ApiKeyTier.FREE);
      expect(key1).not.toBe(key2);
    });

    it('should generate keys of correct length', () => {
      const key = generateApiKey(ApiKeyTier.FREE);
      expect(key.length).toBe(32); // sk_free_ (8) + random (24)
    });
  });

  describe('hashApiKey', () => {
    it('should hash keys consistently', () => {
      const key = 'sk_test_abc123def456ghi789jkl';
      const hash1 = hashApiKey(key);
      const hash2 = hashApiKey(key);
      expect(hash1).toBe(hash2);
    });

    it('should produce 64-character hex string', () => {
      const hash = hashApiKey('test_key');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce different hashes for different keys', () => {
      const hash1 = hashApiKey('key1');
      const hash2 = hashApiKey('key2');
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', () => {
      const hash = hashApiKey('');
      expect(hash).toHaveLength(64);
    });
  });

  describe('extractKeyPrefix', () => {
    it('should extract first 12 characters', () => {
      const key = 'sk_free_abc123def456ghi789';
      const prefix = extractKeyPrefix(key);
      expect(prefix).toBe('sk_free_abc1');
      expect(prefix).toHaveLength(12);
    });

    it('should handle short keys', () => {
      const key = 'short';
      const prefix = extractKeyPrefix(key);
      expect(prefix).toBe('short');
    });
  });

  describe('isValidApiKeyFormat', () => {
    it('should validate correct free tier key', () => {
      // 24 chars suffix: 123456789012345678901234
      const key = 'sk_free_123456789012345678901234';
      expect(isValidApiKeyFormat(key)).toBe(true);
    });

    it('should validate correct pro tier key', () => {
      const key = 'sk_pro_123456789012345678901234';
      expect(isValidApiKeyFormat(key)).toBe(true);
    });

    it('should reject invalid prefix', () => {
      const key = 'invalid_abc123def456ghi789';
      expect(isValidApiKeyFormat(key)).toBe(false);
    });

    it('should reject short key', () => {
      const key = 'sk_free_short';
      expect(isValidApiKeyFormat(key)).toBe(false);
    });

    it('should reject key with invalid characters', () => {
      const key = 'sk_free_abc!@#$%^&*()123456';
      expect(isValidApiKeyFormat(key)).toBe(false);
    });
  });

  describe('extractTierFromKey', () => {
    it('should extract free tier', () => {
      const key = 'sk_free_abc123def456ghi789';
      expect(extractTierFromKey(key)).toBe(ApiKeyTier.FREE);
    });

    it('should extract pro tier', () => {
      const key = 'sk_pro_abc123def456ghi789';
      expect(extractTierFromKey(key)).toBe(ApiKeyTier.PRO);
    });

    it('should extract enterprise tier', () => {
      const key = 'sk_ent_abc123def456ghi789';
      expect(extractTierFromKey(key)).toBe(ApiKeyTier.ENTERPRISE);
    });

    it('should return null for invalid tier', () => {
      const key = 'sk_invalid_abc123def456';
      expect(extractTierFromKey(key)).toBe(null);
    });
  });

  describe('constantTimeCompare', () => {
    it('should return true for equal strings', () => {
      const result = constantTimeCompare('hello', 'hello');
      expect(result).toBe(true);
    });

    it('should return false for different strings', () => {
      const result = constantTimeCompare('hello', 'world');
      expect(result).toBe(false);
    });

    it('should return false for different lengths', () => {
      const result = constantTimeCompare('hello', 'helloworld');
      expect(result).toBe(false);
    });

    it('should handle empty strings', () => {
      const result = constantTimeCompare('', '');
      expect(result).toBe(true);
    });
  });

  describe('maskApiKey', () => {
    it('should mask API key correctly', () => {
      const key = 'sk_free_abc123def456ghi789';
      const masked = maskApiKey(key);
      expect(masked).toBe('sk_free_abc1**************');
    });

    it('should preserve prefix length', () => {
      const key = 'sk_test_abc123def456ghi789';
      const masked = maskApiKey(key);
      expect(masked.substring(0, 12)).toBe('sk_test_abc1');
    });
  });
});