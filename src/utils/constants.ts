/**
 * Application-wide constants
 */

export const API_KEY_PREFIX = {
  FREE: 'sk_free_',
  PRO: 'sk_pro_',
  ENTERPRISE: 'sk_ent_',
  TEST: 'sk_test_',
} as const;

export const RATE_LIMITS = {
  FREE: 100,
  PRO: 1000,
  ENTERPRISE: 10000,
} as const;

export const TIME_WINDOWS = {
  ONE_HOUR: 3600000,
  ONE_DAY: 86400000,
  ONE_WEEK: 604800000,
  ONE_MONTH: 2592000000,
} as const;

export const REPO_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export const CACHE_TTL = {
  SHORT: 300, // 5 minutes
  MEDIUM: 900, // 15 minutes
  LONG: 3600, // 1 hour
  VERY_LONG: 86400, // 24 hours
} as const;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const ERROR_TYPES = {
  VALIDATION_ERROR: 'https://api.devmetrics.com/errors/validation-error',
  AUTHENTICATION_ERROR: 'https://api.devmetrics.com/errors/authentication-error',
  AUTHORIZATION_ERROR: 'https://api.devmetrics.com/errors/authorization-error',
  NOT_FOUND: 'https://api.devmetrics.com/errors/not-found',
  CONFLICT: 'https://api.devmetrics.com/errors/conflict',
  RATE_LIMIT_EXCEEDED: 'https://api.devmetrics.com/errors/rate-limit-exceeded',
  DATABASE_ERROR: 'https://api.devmetrics.com/errors/database-error',
  EXTERNAL_SERVICE_ERROR: 'https://api.devmetrics.com/errors/external-service-error',
  INTERNAL_ERROR: 'https://api.devmetrics.com/errors/internal-server-error',
} as const;

export const REDIS_KEYS = {
  RATE_LIMIT: (apiKeyId: string) => `ratelimit:${apiKeyId}`,
  CACHE_METRICS: (repoId: string, type: string, period: string) =>
    `cache:metrics:${repoId}:${type}:${period}`,
  JOB_QUEUE: 'queue:repo-analysis',
  JOB_QUEUE_RETRY: 'queue:repo-analysis:retry',
  JOB_QUEUE_FAILED: 'queue:repo-analysis:failed',
} as const;

export const COMPLEXITY_THRESHOLDS = {
  LOW: 10,
  MEDIUM: 20,
  HIGH: Infinity,
} as const;

export const QUERY_PERIODS = {
  '24h': 86400000,
  '7d': 604800000,
  '30d': 2592000000,
  '90d': 7776000000,
  '1y': 31536000000,
  all: Infinity,
} as const;
