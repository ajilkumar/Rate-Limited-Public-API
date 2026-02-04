import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { query } from '../config/database';
import logger from '../config/logger';

/**
 * Usage tracking middleware
 * Logs all API requests to database for analytics
 */
export const usageTracker = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();

  // Log response when finished
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;

    // Log asynchronously (don't block response)
    logUsage(req, res, responseTime).catch((error) => {
      logger.error('Failed to log API usage', {
        requestId: req.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });
  });

  next();
};

/**
 * Log API usage to database
 */
async function logUsage(
  req: AuthenticatedRequest,
  res: Response,
  responseTime: number
): Promise<void> {
  try {
    const apiKeyId = req.apiKey?.id || null;
    const endpoint = req.path;
    const method = req.method;
    const statusCode = res.statusCode;
    const ipAddress = req.ip || req.socket.remoteAddress || null;
    const userAgent = req.get('user-agent') || null;

    // Only log error messages for error responses
    const errorMessage = statusCode >= 400 ? res.statusMessage || null : null;

    await query(
      `
      INSERT INTO api_usage (
        api_key_id,
        endpoint,
        method,
        status_code,
        response_time_ms,
        ip_address,
        user_agent,
        error_message
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [apiKeyId, endpoint, method, statusCode, responseTime, ipAddress, userAgent, errorMessage]
    );

    logger.debug('API usage logged', {
      apiKeyId,
      endpoint,
      method,
      statusCode,
      responseTime: `${responseTime}ms`,
    });
  } catch (error) {
    // Don't throw - logging failure shouldn't break the request
    logger.error('Failed to log usage', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
