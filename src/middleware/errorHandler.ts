import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { AppError } from '../utils/errors';
import { HTTP_STATUS, ERROR_TYPES } from '../utils/constants';
import { env } from '../config/env';

/**
 * Global error handling middleware
 * Must be registered LAST in middleware chain
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log error details
  logger.error('Error occurred', {
    requestId: req.id,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Handle operational errors (AppError instances)
  if (err instanceof AppError && err.isOperational) {
    res.status(err.statusCode).json(err.toJSON());
    return;
  }

  // Handle Zod validation errors (shouldn't reach here, but just in case)
  if (err.name === 'ZodError') {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      type: ERROR_TYPES.VALIDATION_ERROR,
      title: 'Validation Error',
      status: HTTP_STATUS.BAD_REQUEST,
      detail: 'Request validation failed',
      errors: err,
    });
    return;
  }

  // Handle PostgreSQL errors
  if (err.name === 'QueryFailedError' || err.name === 'DatabaseError') {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      type: ERROR_TYPES.DATABASE_ERROR,
      title: 'Database Error',
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      detail: env.NODE_ENV === 'production' ? 'Database operation failed' : err.message,
    });
    return;
  }

  // Handle unexpected errors
  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    type: ERROR_TYPES.INTERNAL_ERROR,
    title: 'Internal Server Error',
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    detail:
      env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : err.message || 'Unknown error',
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 Not Found handler
 * Should be registered before error handler
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(HTTP_STATUS.NOT_FOUND).json({
    type: ERROR_TYPES.NOT_FOUND,
    title: 'Not Found',
    status: HTTP_STATUS.NOT_FOUND,
    detail: `Cannot ${req.method} ${req.path}`,
    path: req.path,
    method: req.method,
  });
};
