import { Request } from 'express';

/**
 * API Key tiers
 */
export enum ApiKeyTier {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

/**
 * Repository analysis status
 */
export enum RepositoryStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Database Models
 */
export interface ApiKey {
  id: string;
  keyHash: string;
  keyPrefix: string;
  userEmail: string;
  name: string | null;
  tier: ApiKeyTier;
  rateLimitPerHour: number;
  createdAt: Date;
  lastUsedAt: Date | null;
  isActive: boolean;
  metadata: Record<string, unknown>;
}

export interface Repository {
  id: string;
  apiKeyId: string;
  githubUrl: string;
  owner: string;
  repoName: string;
  defaultBranch: string;
  lastAnalyzedAt: Date | null;
  analysisStatus: RepositoryStatus;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
}

export interface CommitMetric {
  id: number;
  repositoryId: string;
  commitSha: string;
  authorName: string;
  authorEmail: string;
  commitDate: Date;
  filesChanged: number;
  linesAdded: number;
  linesDeleted: number;
  message: string;
  createdAt: Date;
}

export interface FileComplexity {
  id: number;
  repositoryId: string;
  filePath: string;
  language: string;
  linesOfCode: number;
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  functionCount: number;
  analyzedAt: Date;
}

export interface ApiUsage {
  id: number;
  apiKeyId: string | null;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs: number | null;
  ipAddress: string | null;
  userAgent: string | null;
  errorMessage: string | null;
  timestamp: Date;
}

/**
 * Request/Response DTOs
 */
export interface RegisterApiKeyDto {
  email: string;
  name?: string;
  tier?: ApiKeyTier;
}

export interface RegisterApiKeyResponse {
  apiKey: string; // Full key (shown only once)
  id: string;
  email: string;
  tier: ApiKeyTier;
  rateLimitPerHour: number;
  createdAt: string;
  message: string;
}

export interface RegisterRepositoryDto {
  githubUrl: string;
  webhookUrl?: string;
}

export interface RepositoryResponse {
  id: string;
  githubUrl: string;
  owner: string;
  repoName: string;
  status: RepositoryStatus;
  lastAnalyzedAt: string | null;
  createdAt: string;
}

/**
 * Rate Limiting
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
  retryAfter?: number; // Seconds
}

/**
 * Pagination
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Extended Express Request with custom properties
 */
export interface AuthenticatedRequest extends Request {
  apiKey?: ApiKey;
  rateLimit?: RateLimitInfo;
}

/**
 * Error response structure (RFC 7807)
 */
export interface ErrorResponse {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  [key: string]: unknown;
}

/**
 * Query period options
 */
export type QueryPeriod = '24h' | '7d' | '30d' | '90d' | '1y' | 'all';

/**
 * Metrics responses
 */
export interface CommitMetricsResponse {
  repositoryId: string;
  period: QueryPeriod;
  totalCommits: number;
  commitsByAuthor: Record<string, number>;
  commitsByDay: Array<{ date: string; commits: number }>;
  averageCommitsPerDay: number;
}

export interface ComplexityMetricsResponse {
  repositoryId: string;
  language: string;
  totalFiles: number;
  averageComplexity: number;
  filesByComplexity: {
    low: number;
    medium: number;
    high: number;
  };
  mostComplexFiles: Array<{
    filePath: string;
    complexity: number;
  }>;
}

export interface HealthScoreResponse {
  repositoryId: string;
  score: number;
  factors: {
    commitFrequency: number;
    codeQuality: number;
    documentation: number;
    testCoverage: number;
  };
}
