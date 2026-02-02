import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import {
  registerRepository,
  listRepositories,
  getRepository,
  deleteRepository,
} from '../services/repository.service';
import {
  validate,
  registerRepositorySchema,
  uuidParamSchema,
  paginationSchema,
} from '../utils/validators';
import { HTTP_STATUS } from '../utils/constants';
import { asyncHandler } from '../middleware/errorHandler';

/**
 * POST /api/v1/repositories
 * Register a new repository
 */
export const register = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> => {
    if (!req.apiKey) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Validate request body
    const validatedData = validate(registerRepositorySchema)(req.body);

    // Register repository
    const repository = await registerRepository(req.apiKey.id, validatedData);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: repository,
      message: 'Repository registered successfully. Analysis will begin shortly.',
    });
  }
);

/**
 * GET /api/v1/repositories
 * List repositories for authenticated user
 */
export const list = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> => {
    if (!req.apiKey) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Validate query params
    const { page, limit } = validate(paginationSchema)(req.query);
    const status = req.query.status as string | undefined;

    // List repositories
    const result = await listRepositories(req.apiKey.id, {
      page,
      limit,
      status: status as any,
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.repositories,
      pagination: result.pagination,
    });
  }
);

/**
 * GET /api/v1/repositories/:id
 * Get repository details
 */
export const get = asyncHandler(
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

    // Get repository
    const repository = await getRepository(id, req.apiKey.id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: repository,
    });
  }
);

/**
 * DELETE /api/v1/repositories/:id
 * Delete repository
 */
export const remove = asyncHandler(
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

    // Delete repository
    await deleteRepository(id, req.apiKey.id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Repository deleted successfully',
    });
  }
);
