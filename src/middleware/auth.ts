import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { AuthenticationError } from '../utils/errors';
import { hashApiKey, isValidApiKeyFormat } from '../utils/apiKeyGenerator';
import { query } from '../config/database';
import logger from '../config/logger';

/**
 * Authentication middleware
 * Validates API key and attaches user info to request
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract API key from headers
    const apiKey = extractApiKey(req);

    if (!apiKey) {
      throw new AuthenticationError('API key is required');
    }

    // Validate API key format
    if (!isValidApiKeyFormat(apiKey)) {
      throw new AuthenticationError('Invalid API key format');
    }

    // Hash the API key
    const keyHash = hashApiKey(apiKey);

    // Lookup API key in database
    const result = await query(
      `
      SELECT 
        id, key_hash, key_prefix, user_email, name, tier,
        rate_limit_per_hour, created_at, last_used_at, is_active, metadata
      FROM api_keys
      WHERE key_hash = $1
      `,
      [keyHash]
    );

    if (result.rows.length === 0) {
      throw new AuthenticationError('Invalid API key');
    }

    const apiKeyData = result.rows[0];

    // Check if key is active
    if (!apiKeyData.is_active) {
      throw new AuthenticationError('API key has been deactivated');
    }

    // Attach API key info to request
    req.apiKey = {
      id: apiKeyData.id,
      keyHash: apiKeyData.key_hash,
      keyPrefix: apiKeyData.key_prefix,
      userEmail: apiKeyData.user_email,
      name: apiKeyData.name,
      tier: apiKeyData.tier,
      rateLimitPerHour: apiKeyData.rate_limit_per_hour,
      createdAt: apiKeyData.created_at,
      lastUsedAt: apiKeyData.last_used_at,
      isActive: apiKeyData.is_active,
      metadata: apiKeyData.metadata || {},
    };

    // Update last_used_at (async, don't await)
    updateLastUsed(apiKeyData.id).catch((err) => {
      logger.warn('Failed to update last_used_at', {
        apiKeyId: apiKeyData.id,
        error: err.message,
      });
    });

    logger.debug('Authentication successful', {
      apiKeyId: apiKeyData.id,
      userEmail: apiKeyData.user_email,
      tier: apiKeyData.tier,
    });

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Extract API key from request headers
 * Supports: Authorization: Bearer <key> OR X-API-Key: <key>
 */
const extractApiKey = (req: AuthenticatedRequest): string | null => {
  // Try Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Try X-API-Key header
  const apiKeyHeader = req.headers['x-api-key'];
  if (apiKeyHeader && typeof apiKeyHeader === 'string') {
    return apiKeyHeader;
  }

  return null;
};

/**
 * Update last_used_at timestamp
 */
const updateLastUsed = async (apiKeyId: string): Promise<void> => {
  await query(
    `
    UPDATE api_keys
    SET last_used_at = NOW()
    WHERE id = $1
    `,
    [apiKeyId]
  );
};
