import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { getOverallUsageStats, getApiKeyUsageStats } from '../services/usageAnalytics.service';
import { validate, periodSchema } from '../utils/validators';
import { HTTP_STATUS } from '../utils/constants';
import { asyncHandler } from '../middleware/errorHandler';

/**
 * GET /api/v1/usage/stats
 * Get usage statistics
 */
export const getStats = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> => {
    if (!req.apiKey) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Validate query params
    const { period } = validate(periodSchema)(req.query);

    // Get stats
    const stats = await getOverallUsageStats(req.apiKey.id, period as any);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: stats,
    });
  }
);

/**
 * GET /api/v1/usage/quota
 * Get current quota usage
 */
export const getQuota = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> => {
    if (!req.apiKey) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Get quota stats
    const stats = await getApiKeyUsageStats(req.apiKey.id, req.apiKey.rateLimitPerHour);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: stats,
    });
  }
);