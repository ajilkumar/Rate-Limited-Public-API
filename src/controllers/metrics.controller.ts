import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, QueryPeriod } from '../types';
import {
  getCommitFrequencyMetrics,
  getContributorMetrics,
  getActivityMetrics,
  getRepositorySummary,
} from '../services/metrics.service';
import { getRepository } from '../services/repository.service';
import { triggerAnalysis, getCommitCount } from '../services/commitAnalysis.service';
import { validate, uuidParamSchema, periodSchema } from '../utils/validators';
import { HTTP_STATUS } from '../utils/constants';
import { asyncHandler } from '../middleware/errorHandler';

/**
 * GET /api/v1/repositories/:id/metrics/commits
 * Get commit frequency metrics
 */
export const getCommitMetrics = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> => {
    if (!req.apiKey) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Validate params
    const { id } = validate(uuidParamSchema)(req.params);
    const { period } = validate(periodSchema)(req.query);

    // Check repository ownership
    await getRepository(id, req.apiKey.id);

    // Get metrics
    const metrics = await getCommitFrequencyMetrics(id, period as QueryPeriod);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: metrics,
    });
  }
);

/**
 * GET /api/v1/repositories/:id/metrics/contributors
 * Get contributor metrics
 */
export const getContributorMetricsHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> => {
    if (!req.apiKey) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Validate params
    const { id } = validate(uuidParamSchema)(req.params);
    const { period } = validate(periodSchema)(req.query);
    const limit = parseInt(req.query.limit as string) || 10;

    // Check repository ownership
    await getRepository(id, req.apiKey.id);

    // Get metrics
    const metrics = await getContributorMetrics(id, period as QueryPeriod, limit);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: metrics,
    });
  }
);

/**
 * GET /api/v1/repositories/:id/metrics/activity
 * Get activity metrics
 */
export const getActivityMetricsHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> => {
    if (!req.apiKey) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Validate params
    const { id } = validate(uuidParamSchema)(req.params);
    const { period } = validate(periodSchema)(req.query);

    // Check repository ownership
    await getRepository(id, req.apiKey.id);

    // Get metrics
    const metrics = await getActivityMetrics(id, period as QueryPeriod);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: metrics,
    });
  }
);

/**
 * GET /api/v1/repositories/:id/metrics/summary
 * Get repository summary
 */
export const getSummary = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> => {
    if (!req.apiKey) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Validate params
    const { id } = validate(uuidParamSchema)(req.params);

    // Check repository ownership
    await getRepository(id, req.apiKey.id);

    // Get summary
    const summary = await getRepositorySummary(id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: summary,
    });
  }
);

/**
 * POST /api/v1/repositories/:id/analyze
 * Trigger repository analysis
 */
export const analyze = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> => {
    if (!req.apiKey) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Validate params
    const { id } = validate(uuidParamSchema)(req.params);

    // Check repository ownership
    const repository = await getRepository(id, req.apiKey.id);

    // Check if already analyzed
    const commitCount = await getCommitCount(id);

    if (commitCount > 0) {
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Repository already analyzed',
        data: {
          repositoryId: id,
          status: repository.analysisStatus,
          commitCount,
        },
      });
      return;
    }

    // Trigger analysis
    await triggerAnalysis(id);

    res.status(HTTP_STATUS.ACCEPTED).json({
      success: true,
      message: 'Analysis started. This may take a few minutes.',
      data: {
        repositoryId: id,
        status: 'processing',
      },
    });
  }
);
