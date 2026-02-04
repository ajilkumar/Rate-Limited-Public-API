import crypto from 'crypto';
import { API_KEY_PREFIX } from './constants';
import { ApiKeyTier } from '../types';

/**
 * Generate a random API key
 * Format: sk_{tier}_{random_24_chars}
 * Example: sk_free_a1b2c3d4e5f6g7h8i9j0k1l2
 */
export const generateApiKey = (tier: ApiKeyTier = ApiKeyTier.FREE): string => {
  // Get tier prefix
  const prefix = getApiKeyPrefix(tier);

  // Generate random bytes and convert to base62 (alphanumeric)
  const randomBytes = crypto.randomBytes(16);
  const randomString = base62Encode(randomBytes);

  return `${prefix}${randomString}`;
};

/**
 * Get API key prefix based on tier
 */
const getApiKeyPrefix = (tier: ApiKeyTier): string => {
  switch (tier) {
    case ApiKeyTier.FREE:
      return API_KEY_PREFIX.FREE;
    case ApiKeyTier.PRO:
      return API_KEY_PREFIX.PRO;
    case ApiKeyTier.ENTERPRISE:
      return API_KEY_PREFIX.ENTERPRISE;
    default:
      return API_KEY_PREFIX.TEST;
  }
};

/**
 * Hash API key for storage
 * Uses SHA-256 for one-way hashing
 */
export const hashApiKey = (apiKey: string): string => {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
};

/**
 * Extract key prefix for display (first 12 characters)
 * Example: sk_free_a1b2 from sk_free_a1b2c3d4e5f6g7h8i9j0k1l2
 */
export const extractKeyPrefix = (apiKey: string): string => {
  return apiKey.substring(0, 12);
};

/**
 * Validate API key format
 */
export const isValidApiKeyFormat = (apiKey: string): boolean => {
  // Check format: sk_{tier}_{24_chars}
  const pattern = /^sk_(free|pro|ent|test)_[A-Za-z0-9]{24}$/;
  return pattern.test(apiKey);
};

/**
 * Extract tier from API key
 */
export const extractTierFromKey = (apiKey: string): ApiKeyTier | null => {
  if (apiKey.startsWith(API_KEY_PREFIX.FREE)) return ApiKeyTier.FREE;
  if (apiKey.startsWith(API_KEY_PREFIX.PRO)) return ApiKeyTier.PRO;
  if (apiKey.startsWith(API_KEY_PREFIX.ENTERPRISE)) return ApiKeyTier.ENTERPRISE;
  return null;
};

/**
 * Base62 encoding (alphanumeric: 0-9, a-z, A-Z)
 * Used to generate URL-safe random strings
 */
const base62Encode = (buffer: Buffer): string => {
  const charset = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  let num = BigInt('0x' + buffer.toString('hex'));

  while (num > 0n) {
    const remainder = Number(num % 62n);
    result = charset[remainder] + result;
    num = num / 62n;
  }

  // Pad to 24 characters
  return result.padStart(24, '0');
};

/**
 * Constant-time string comparison (prevents timing attacks)
 */
export const constantTimeCompare = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
};

/**
 * Mask API key for display
 * Example: sk_free_a1b2c3d4e5f6g7h8i9j0k1l2 → sk_free_a1b2****************
 */
export const maskApiKey = (apiKey: string): string => {
  const prefix = extractKeyPrefix(apiKey);
  const masked = '*'.repeat(apiKey.length - prefix.length);
  return `${prefix}${masked}`;
};
