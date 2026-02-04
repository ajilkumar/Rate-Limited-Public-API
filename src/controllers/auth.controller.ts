import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import {
  registerApiKey,
  listApiKeys,
  revokeApiKey,
  deleteApiKey,
  getApiKeyStats,
} from '../services/auth.service';
import { validate, registerApiKeySchema, uuidParamSchema } from '../utils/validators';
import { HTTP_STATUS } from '../utils/constants';
import { asyncHandler } from '../middleware/errorHandler';
// import { maskApiKey } from '@/utils/apiKeyGenerator';
/**
 * POST /api/v1/auth/register
 * Register a new API key
 */
export const register = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> => {
    // Validate request body
    const validatedData = validate(registerApiKeySchema)(req.body);

    // Register API key
    const response = await registerApiKey(validatedData);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: response,
    });
  }
);

/**
 * GET /api/v1/auth/keys
 * List all API keys for authenticated user
 */
export const listKeys = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> => {
    // Ensure user is authenticated
    if (!req.apiKey) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const keys = await listApiKeys(req.apiKey.userEmail);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        keys,
        total: keys.length,
      },
    });
  }
);

/**
 * GET /api/v1/auth/keys/:id
 * Get details of a specific API key
 */
export const getKey = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> => {
    if (!req.apiKey) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Validate UUID
    const { id } = validate(uuidParamSchema)(req.params);

    // Get key stats
    const stats = await getApiKeyStats(id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        id,
        stats,
      },
    });
  }
);

/**
 * DELETE /api/v1/auth/keys/:id/revoke
 * Revoke (soft delete) an API key
 */
export const revoke = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> => {
    if (!req.apiKey) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Validate UUID
    const { id } = validate(uuidParamSchema)(req.params);

    await revokeApiKey(id, req.apiKey.userEmail);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'API key revoked successfully',
    });
  }
);

/**
 * DELETE /api/v1/auth/keys/:id
 * Permanently delete an API key
 */
export const deleteKey = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> => {
    if (!req.apiKey) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Validate UUID
    const { id } = validate(uuidParamSchema)(req.params);

    await deleteApiKey(id, req.apiKey.userEmail);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'API key deleted permanently',
    });
  }
);

/**
 * GET /api/v1/auth/me
 * Get current authenticated user info
 */
export const getCurrentUser = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> => {
    if (!req.apiKey) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        id: req.apiKey.id,
        keyPrefix: req.apiKey.keyPrefix,
        email: req.apiKey.userEmail,
        name: req.apiKey.name,
        tier: req.apiKey.tier,
        rateLimitPerHour: req.apiKey.rateLimitPerHour,
        createdAt: req.apiKey.createdAt,
        lastUsedAt: req.apiKey.lastUsedAt,
      },
    });
  }
);