import { z } from 'zod';
import dotenv from 'dotenv';
import logger from './logger';

// Load .env file
dotenv.config();

/**
 * Environment variable schema with validation
 */
const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  API_VERSION: z.string().default('v1'),
  APP_URL: z.url().default('http://localhost:3000'),

  // Database
  DATABASE_URL: z.string().min(1),
  DB_POOL_MIN: z.coerce.number().int().positive().default(2),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),

  // Redis
  REDIS_URL: z.string().min(1),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(3600000),
  RATE_LIMIT_FREE_TIER: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_PRO_TIER: z.coerce.number().int().positive().default(1000),
  RATE_LIMIT_ENTERPRISE_TIER: z.coerce.number().int().positive().default(10000),

  // GitHub
  GITHUB_TOKEN: z.string().min(1),
  GITHUB_API_URL: z.url().default('https://api.github.com'),

  // Security
  API_KEY_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string().default('*'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  LOG_TO_FILE: z.coerce.boolean().default(true),

  // Cache
  CACHE_TTL_SHORT: z.coerce.number().int().positive().default(300),
  CACHE_TTL_MEDIUM: z.coerce.number().int().positive().default(900),
  CACHE_TTL_LONG: z.coerce.number().int().positive().default(3600),
  CACHE_TTL_VERY_LONG: z.coerce.number().int().positive().default(86400),

  // Job Queue
  JOB_TIMEOUT_MS: z.coerce.number().int().positive().default(300000),
  JOB_MAX_RETRIES: z.coerce.number().int().positive().default(3),
  JOB_RETRY_DELAY_MS: z.coerce.number().int().positive().default(5000),

  // Pagination
  PAGINATION_DEFAULT_PAGE: z.coerce.number().int().positive().default(1),
  PAGINATION_DEFAULT_LIMIT: z.coerce.number().int().positive().default(20),
  PAGINATION_MAX_LIMIT: z.coerce.number().int().positive().default(100),

  // Repository Analysis
  MAX_COMMITS_TO_ANALYZE: z.coerce.number().int().positive().default(1000),
  MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(1048576),
  GIT_OPERATION_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),

  // Feature Flags
  ENABLE_WEBHOOKS: z.coerce.boolean().default(false),
  ENABLE_EMAIL_NOTIFICATIONS: z.coerce.boolean().default(false),
  ENABLE_COMPLEXITY_ANALYSIS: z.coerce.boolean().default(true),
  ENABLE_HEALTH_SCORE: z.coerce.boolean().default(true),
});

/**
 * Validate and parse environment variables
 */
function validateEnv() {
  try {
    const parsed = envSchema.parse(process.env);
    logger.info('Environment variables validated successfully');
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Environment validation failed:', {
        errors: error.issues.map((err: any) => ({
          path: err.path.join('.'),
          message: err.message,
        })),
      });
      console.error('\n❌ Invalid environment configuration:');
      error.issues.forEach((err: any) => {
        console.error(`   ${err.path.join('.')}: ${err.message}`);
      });
      console.error('\n📝 Please check your .env file\n');
    }
    process.exit(1);
  }
}

export const env = validateEnv();

// Type-safe environment object
export type Env = z.infer<typeof envSchema>;