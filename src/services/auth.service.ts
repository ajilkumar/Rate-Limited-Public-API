import { query, transaction } from '../config/database';
import { ApiKey, ApiKeyTier, RegisterApiKeyDto, RegisterApiKeyResponse } from '../types';
import {
  generateApiKey,
  hashApiKey,
  extractKeyPrefix,
  constantTimeCompare,
} from '../utils/apiKeyGenerator';
import { ConflictError, NotFoundError, AuthenticationError } from '../utils/errors';
import logger from '../config/logger';
import { RATE_LIMITS } from '../utils/constants';

/**
 * Database representation of ApiKey (snake_case columns)
 */
interface DbApiKey {
  id: string;
  key_hash: string;
  key_prefix: string;
  user_email: string;
  name: string | null;
  tier: string;
  rate_limit_per_hour: number;
  created_at: Date;
  last_used_at: Date | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
}

/**
 * Register a new API key
 */
export async function registerApiKey(data: RegisterApiKeyDto): Promise<RegisterApiKeyResponse> {
  const { email, name, tier = ApiKeyTier.FREE } = data;

  return transaction(async (client) => {
    try {
      // Check if user already has an active key
      const existingKey = await client.query<DbApiKey>(
        `SELECT id FROM api_keys WHERE user_email = $1 AND is_active = true LIMIT 1`,
        [email]
      );

      if (existingKey.rows.length > 0) {
        throw new ConflictError(
          'An active API key already exists for this email. Please revoke the existing key first.'
        );
      }

      // Generate new API key
      const rawApiKey = generateApiKey(tier);
      const keyHash = hashApiKey(rawApiKey);
      const keyPrefix = extractKeyPrefix(rawApiKey);

      // Determine rate limit based on tier
      const rateLimitPerHour = RATE_LIMITS[tier.toUpperCase() as keyof typeof RATE_LIMITS];

      // Insert into database
      const result = await client.query<DbApiKey>(
        `
        INSERT INTO api_keys (
          key_hash,
          key_prefix,
          user_email,
          name,
          tier,
          rate_limit_per_hour
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, key_prefix, user_email, name, tier, rate_limit_per_hour, created_at
        `,
        [keyHash, keyPrefix, email, name || null, tier, rateLimitPerHour]
      );

      const apiKey = result.rows[0];

      if (!apiKey) {
        throw new Error('Failed to retrieve created API key');
      }

      logger.info('API key registered successfully', {
        apiKeyId: apiKey.id,
        email,
        tier,
      });

      // Return response with raw key (ONLY TIME IT'S SHOWN!)
      // Map snake_case DB fields to camelCase response DTO
      return {
        apiKey: rawApiKey, // Full key - user must save this!
        id: apiKey.id,
        email: apiKey.user_email,
        tier: apiKey.tier as ApiKeyTier,
        rateLimitPerHour: apiKey.rate_limit_per_hour,
        createdAt: apiKey.created_at.toISOString(),
        message:
          'IMPORTANT: Save this API key now. For security reasons, it will not be shown again.',
      };
    } catch (error) {
      logger.error('Failed to register API key', {
        email,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  });
}

/**
 * Validate API key and return key info
 */
export async function validateApiKey(rawApiKey: string): Promise<ApiKey | null> {
  try {
    const keyHash = hashApiKey(rawApiKey);

    const result = await query<DbApiKey>(
      `
      SELECT 
        id,
        key_hash,
        key_prefix,
        user_email,
        name,
        tier,
        rate_limit_per_hour,
        created_at,
        last_used_at,
        is_active,
        metadata
      FROM api_keys
      WHERE key_hash = $1
      `,
      [keyHash]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const apiKey = result.rows[0];

    if (!apiKey) {
      return null;
    }

    // Check if key is active
    if (!apiKey.is_active) {
      throw new AuthenticationError('This API key has been deactivated');
    }

    // Use constant-time comparison for security (prevents timing attacks)
    if (!constantTimeCompare(apiKey.key_hash, keyHash)) {
      return null;
    }

    return {
      id: apiKey.id,
      keyHash: apiKey.key_hash,
      keyPrefix: apiKey.key_prefix,
      userEmail: apiKey.user_email,
      name: apiKey.name,
      tier: apiKey.tier as ApiKeyTier,
      rateLimitPerHour: apiKey.rate_limit_per_hour,
      createdAt: apiKey.created_at,
      lastUsedAt: apiKey.last_used_at,
      isActive: apiKey.is_active,
      metadata: apiKey.metadata || {},
    };
  } catch (error) {
    logger.error('API key validation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * List all API keys for a user
 */
export async function listApiKeys(email: string): Promise<Partial<ApiKey>[]> {
  try {
    const result = await query<DbApiKey>(
      `
      SELECT 
        id,
        key_prefix,
        name,
        tier,
        rate_limit_per_hour,
        created_at,
        last_used_at,
        is_active
      FROM api_keys
      WHERE user_email = $1
      ORDER BY created_at DESC
      `,
      [email]
    );

    return result.rows.map((row) => ({
      id: row.id,
      keyPrefix: row.key_prefix,
      name: row.name,
      tier: row.tier as ApiKeyTier,
      rateLimitPerHour: row.rate_limit_per_hour,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
      isActive: row.is_active,
    }));
  } catch (error) {
    logger.error('Failed to list API keys', {
      email,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Revoke an API key (soft delete)
 */
export async function revokeApiKey(apiKeyId: string, userEmail: string): Promise<void> {
  try {
    const result = await query(
      `
      UPDATE api_keys
      SET is_active = false
      WHERE id = $1 AND user_email = $2
      RETURNING id
      `,
      [apiKeyId, userEmail]
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('API key not found or does not belong to this user');
    }

    logger.info('API key revoked', {
      apiKeyId,
      userEmail,
    });
  } catch (error) {
    logger.error('Failed to revoke API key', {
      apiKeyId,
      userEmail,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Delete an API key permanently (hard delete)
 */
export async function deleteApiKey(apiKeyId: string, userEmail: string): Promise<void> {
  try {
    const result = await query(
      `
      DELETE FROM api_keys
      WHERE id = $1 AND user_email = $2
      RETURNING id
      `,
      [apiKeyId, userEmail]
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('API key not found or does not belong to this user');
    }

    logger.info('API key deleted permanently', {
      apiKeyId,
      userEmail,
    });
  } catch (error) {
    logger.error('Failed to delete API key', {
      apiKeyId,
      userEmail,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Get API key statistics
 */
export async function getApiKeyStats(apiKeyId: string): Promise<{
  totalRequests: number;
  requestsLast24h: number;
  averageResponseTime: number;
  errorRate: number;
}> {
  try {
    const result = await query(
      `
      SELECT 
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE timestamp >= NOW() - INTERVAL '24 hours') as requests_last_24h,
        AVG(response_time_ms) as avg_response_time,
        COUNT(*) FILTER (WHERE status_code >= 400) * 100.0 / NULLIF(COUNT(*), 0) as error_rate
      FROM api_usage
      WHERE api_key_id = $1
      `,
      [apiKeyId]
    );

    const stats = result.rows[0];

    return {
      totalRequests: parseInt(stats.total_requests) || 0,
      requestsLast24h: parseInt(stats.requests_last_24h) || 0,
      averageResponseTime: Math.round(parseFloat(stats.avg_response_time) || 0),
      errorRate: parseFloat(stats.error_rate) || 0,
    };
  } catch (error) {
    logger.error('Failed to get API key stats', {
      apiKeyId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}