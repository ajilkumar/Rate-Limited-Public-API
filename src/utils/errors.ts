import { HTTP_STATUS, ERROR_TYPES } from './constants';
import { ErrorResponse } from '../types';

/**
 * Base application error class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly type: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, type: string) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.type = type;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): ErrorResponse {
    return {
      type: this.type,
      title: this.name,
      status: this.statusCode,
      detail: this.message,
    };
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends AppError {
  public readonly errors: Array<{ field: string; message: string }>;

  constructor(message: string, errors: Array<{ field: string; message: string }> = []) {
    super(message, HTTP_STATUS.BAD_REQUEST, ERROR_TYPES.VALIDATION_ERROR);
    this.errors = errors;
  }

  toJSON(): ErrorResponse {
    return {
      ...super.toJSON(),
      errors: this.errors,
    };
  }
}

/**
 * Authentication error (401)
 */
export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, HTTP_STATUS.UNAUTHORIZED, ERROR_TYPES.AUTHENTICATION_ERROR);
  }
}

/**
 * Authorization error (403)
 */
export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, HTTP_STATUS.FORBIDDEN, ERROR_TYPES.AUTHORIZATION_ERROR);
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends AppError {
  public readonly resource: string;

  constructor(resource = 'Resource') {
    super(`${resource} not found`, HTTP_STATUS.NOT_FOUND, ERROR_TYPES.NOT_FOUND);
    this.resource = resource;
  }

  toJSON(): ErrorResponse {
    return {
      ...super.toJSON(),
      resource: this.resource,
    };
  }
}

/**
 * Conflict error (409)
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, HTTP_STATUS.CONFLICT, ERROR_TYPES.CONFLICT);
  }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends AppError {
  public readonly rateLimit: {
    limit: number;
    remaining: number;
    reset: number;
    retryAfter: number;
  };

  constructor(limit: number, reset: number, retryAfter: number) {
    super(
      `Rate limit exceeded. Maximum ${limit} requests per hour.`,
      HTTP_STATUS.TOO_MANY_REQUESTS,
      ERROR_TYPES.RATE_LIMIT_EXCEEDED
    );
    this.rateLimit = {
      limit,
      remaining: 0,
      reset,
      retryAfter,
    };
  }

  toJSON(): ErrorResponse {
    return {
      ...super.toJSON(),
      rate_limit: this.rateLimit,
    };
  }
}

/**
 * Database error (500)
 */
export class DatabaseError extends AppError {
  constructor(message = 'Database operation failed') {
    super(message, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_TYPES.DATABASE_ERROR);
  }
}

/**
 * External service error (503)
 */
export class ExternalServiceError extends AppError {
  public readonly service: string;

  constructor(service: string, message: string) {
    super(
      `External service error: ${service} - ${message}`,
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      ERROR_TYPES.EXTERNAL_SERVICE_ERROR
    );
    this.service = service;
  }

  toJSON(): ErrorResponse {
    return {
      ...super.toJSON(),
      service: this.service,
    };
  }
}