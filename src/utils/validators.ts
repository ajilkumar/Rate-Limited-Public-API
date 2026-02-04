import { z } from 'zod';
import { ValidationError } from './errors';
import { ApiKeyTier } from '../types';

/**
 * Zod schemas for request validation
 */

// Email validation
export const emailSchema = z.email('Invalid email address');

// UUID validation
export const uuidSchema = z.uuid('Invalid UUID format');

// GitHub URL validation
export const githubUrlSchema = z
  .url('Invalid URL')
  .regex(
    /^https:\/\/github\.com\/[\w-]+\/[\w.-]+$/,
    'Must be a valid GitHub repository URL (e.g., https://github.com/owner/repo)'
  );

// API Key registration schema
export const registerApiKeySchema = z.object({
  email: emailSchema,
  name: z.string().min(1).max(255).optional(),
  tier: z.nativeEnum(ApiKeyTier).default(ApiKeyTier.FREE),
});

// Repository registration schema
export const registerRepositorySchema = z.object({
  github_url: githubUrlSchema,
  webhook_url: z.url().optional(),
});

// Query parameter schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const periodSchema = z.object({
  period: z.enum(['24h', '7d', '30d', '90d', '1y', 'all']).default('30d'),
});

// UUID param validation
export const uuidParamSchema = z.object({
  id: uuidSchema,
});

/**
 * Validation helper function
 * @param schema - Zod schema to validate against
 * @returns Validated data
 * @throws ValidationError if validation fails
 */
export const validate = <T>(schema: z.ZodSchema<T>) => {
  return (data: unknown): T => {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        throw new ValidationError('Validation failed', errors);
      }
      throw error;
    }
  };
};

/**
 * Async validation wrapper
 */
export const validateAsync = <T>(schema: z.ZodSchema<T>) => {
  return async (data: unknown): Promise<T> => {
    try {
      return await schema.parseAsync(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        throw new ValidationError('Validation failed', errors);
      }
      throw error;
    }
  };
};

/**
 * Safe validation (doesn't throw, returns result object)
 */
export const validateSafe = <T>(schema: z.ZodSchema<T>) => {
  return (
    data: unknown
  ): { success: true; data: T } | { success: false; errors: Array<{ field: string; message: string }> } => {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    const errors = result.error.issues.map((err: any) => ({
      field: err.path.join('.'),
      message: err.message,
    }));
    return { success: false, errors };
  };
};