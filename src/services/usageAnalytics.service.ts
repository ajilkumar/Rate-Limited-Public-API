import { query } from '../config/database';
import { setex, get } from '../config/redis';
import { CACHE_TTL } from '../utils/constants';
import logger from '../config/logger';
import { QueryPeriod } from '../types';

interface UsageStats {
  period: QueryPeriod;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rateLimitedRequests: number;
  averageResponseTime: number;
  requestsByEndpoint: Record<string, number>;
  requestsByStatusCode: Record<string, number>;
  requestsByDay: Array<{ date: string; requests: number }>;
}

interface ApiKeyUsageStats {
  apiKeyId: string;
  period: QueryPeriod;
  totalRequests: number;
  remainingQuota: number;
  quotaLimit: number;
  topEndpoints: Array<{ endpoint: string; requests: number }>;
  errorRate: number;
  averageResponseTime: number;
}

/**
 * Get overall usage statistics
 */
export async function getOverallUsageStats(
  apiKeyId: string,
  period: QueryPeriod = '30d'
): Promise<UsageStats> {
  const cacheKey = `cache:usage:overall:${apiKeyId}:${period}`;

  try {
    // Check cache
    const cached = await get<UsageStats>(cacheKey);
    if (cached) {
      logger.debug('Cache hit for usage stats', { apiKeyId, period });
      return cached;
    }

    // Calculate time range
    const timeRange = getTimeRange(period);

    // Get overall stats
    const statsResult = await query(
      `
      SELECT 
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE status_code < 400) as successful_requests,
        COUNT(*) FILTER (WHERE status_code >= 400 AND status_code < 500) as failed_requests,
        COUNT(*) FILTER (WHERE status_code = 429) as rate_limited_requests,
        AVG(response_time_ms) as avg_response_time
      FROM api_usage
      WHERE api_key_id = $1
        AND timestamp >= $2
      `,
      [apiKeyId, timeRange]
    );

    // Get requests by endpoint
    const endpointResult = await query(
      `
      SELECT 
        endpoint,
        COUNT(*) as requests
      FROM api_usage
      WHERE api_key_id = $1
        AND timestamp >= $2
      GROUP BY endpoint
      ORDER BY requests DESC
      LIMIT 10
      `,
      [apiKeyId, timeRange]
    );

    // Get requests by status code
    const statusResult = await query(
      `
      SELECT 
        status_code,
        COUNT(*) as requests
      FROM api_usage
      WHERE api_key_id = $1
        AND timestamp >= $2
      GROUP BY status_code
      ORDER BY requests DESC
      `,
      [apiKeyId, timeRange]
    );

    // Get requests by day
    const dayResult = await query(
      `
      SELECT 
        DATE(timestamp) as day,
        COUNT(*) as requests
      FROM api_usage
      WHERE api_key_id = $1
        AND timestamp >= $2
      GROUP BY DATE(timestamp)
      ORDER BY day DESC
      `,
      [apiKeyId, timeRange]
    );

    const stats = statsResult.rows[0];

    const usageStats: UsageStats = {
      period,
      totalRequests: parseInt(stats.total_requests) || 0,
      successfulRequests: parseInt(stats.successful_requests) || 0,
      failedRequests: parseInt(stats.failed_requests) || 0,
      rateLimitedRequests: parseInt(stats.rate_limited_requests) || 0,
      averageResponseTime: Math.round(parseFloat(stats.avg_response_time) || 0),
      requestsByEndpoint: endpointResult.rows.reduce((acc, row) => {
        acc[row.endpoint] = parseInt(row.requests);
        return acc;
      }, {} as Record<string, number>),
      requestsByStatusCode: statusResult.rows.reduce((acc, row) => {
        acc[row.status_code] = parseInt(row.requests);
        return acc;
      }, {} as Record<string, number>),
      requestsByDay: dayResult.rows.map((row) => ({
        date: row.day.toISOString().split('T')[0],
        requests: parseInt(row.requests),
      })),
    };

    // Cache the result
    await setex(cacheKey, usageStats, CACHE_TTL.SHORT);

    return usageStats;
  } catch (error) {
    logger.error('Failed to get usage stats', {
      apiKeyId,
      period,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Get API key usage stats (quota tracking)
 */
export async function getApiKeyUsageStats(
  apiKeyId: string,
  rateLimitPerHour: number
): Promise<ApiKeyUsageStats> {
  try {
    // Get requests in last hour
    const hourResult = await query(
      `
      SELECT COUNT(*) as requests_last_hour
      FROM api_usage
      WHERE api_key_id = $1
        AND timestamp >= NOW() - INTERVAL '1 hour'
      `,
      [apiKeyId]
    );

    // Get total requests
    const totalResult = await query(
      `SELECT COUNT(*) as total FROM api_usage WHERE api_key_id = $1`,
      [apiKeyId]
    );

    // Get top endpoints
    const endpointsResult = await query(
      `
      SELECT 
        endpoint,
        COUNT(*) as requests
      FROM api_usage
      WHERE api_key_id = $1
      GROUP BY endpoint
      ORDER BY requests DESC
      LIMIT 5
      `,
      [apiKeyId]
    );

    // Get error rate
    const errorResult = await query(
      `
      SELECT 
        COUNT(*) FILTER (WHERE status_code >= 400) * 100.0 / NULLIF(COUNT(*), 0) as error_rate,
        AVG(response_time_ms) as avg_response_time
      FROM api_usage
      WHERE api_key_id = $1
      `,
      [apiKeyId]
    );

    const requestsLastHour = parseInt(hourResult.rows[0].requests_last_hour) || 0;
    const errorStats = errorResult.rows[0];

    return {
      apiKeyId,
      period: '1y',
      totalRequests: parseInt(totalResult.rows[0].total) || 0,
      remainingQuota: Math.max(0, rateLimitPerHour - requestsLastHour),
      quotaLimit: rateLimitPerHour,
      topEndpoints: endpointsResult.rows.map((row) => ({
        endpoint: row.endpoint,
        requests: parseInt(row.requests),
      })),
      errorRate: parseFloat(errorStats.error_rate) || 0,
      averageResponseTime: Math.round(parseFloat(errorStats.avg_response_time) || 0),
    };
  } catch (error) {
    logger.error('Failed to get API key usage stats', {
      apiKeyId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Helper: Calculate time range based on period
 */
function getTimeRange(period: QueryPeriod): Date {
  const now = new Date();

  switch (period) {
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case '1y':
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    case 'all':
      return new Date('1970-01-01');
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}