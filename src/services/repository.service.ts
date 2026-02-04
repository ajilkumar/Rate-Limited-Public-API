import { query } from '../config/database';
import { Repository, RepositoryRow, RepositoryStatus, RegisterRepositoryDto, RepositoryResponse } from '../types';
import { NotFoundError, ConflictError, ValidationError, AuthorizationError } from '../utils/errors';
import { parseGitHubUrl, validateRepoAccess } from './github.service';
import logger from '../config/logger';

/**
 * Register a new repository for analysis
 */
export async function registerRepository(
  apiKeyId: string,
  data: RegisterRepositoryDto
): Promise<RepositoryResponse> {
  const { github_url } = data;

  try {
    // Validate GitHub URL format
    const { owner, repo } = parseGitHubUrl(github_url);

    // Check if repository already exists
    const existingRepo = await query<RepositoryRow>(
      `SELECT id, analysis_status FROM repositories WHERE github_url = $1 LIMIT 1`,
      [github_url]
    );

    if (existingRepo.rows.length > 0) {
      throw new ConflictError('This repository has already been registered');
    }

    // Validate repository access via GitHub API
    const validation = await validateRepoAccess(github_url);

    if (!validation.valid) {
      throw new ValidationError(validation.error || 'Repository validation failed');
    }

    const repoInfo = validation.repoInfo!;

    // Insert repository
    const result = await query<RepositoryRow>(
      `
      INSERT INTO repositories (
        api_key_id,
        github_url,
        owner,
        repo_name,
        default_branch,
        analysis_status,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING 
        id,
        github_url,
        owner,
        repo_name,
        default_branch,
        analysis_status,
        last_analyzed_at,
        created_at
      `,
      [
        apiKeyId,
        github_url,
        owner,
        repo,
        repoInfo.default_branch,
        RepositoryStatus.PENDING,
        JSON.stringify({
          description: repoInfo.description,
          language: repoInfo.language,
          stars: repoInfo.stargazers_count,
          forks: repoInfo.forks_count,
          open_issues: repoInfo.open_issues_count,
          size_kb: repoInfo.size,
          created_at: repoInfo.created_at,
          updated_at: repoInfo.updated_at,
          topics: repoInfo.topics,
          license: repoInfo.license?.name,
        }),
      ]
    );

    const repository = result.rows[0]!;

    logger.info('Repository registered successfully', {
      repositoryId: repository.id,
      apiKeyId,
      owner,
      repo,
    });

    return {
      id: repository.id,
      githubUrl: repository.github_url,
      owner: repository.owner,
      repoName: repository.repo_name,
      status: repository.analysis_status as RepositoryStatus,
      lastAnalyzedAt: repository.last_analyzed_at?.toISOString() || null,
      createdAt: repository.created_at.toISOString(),
    };
  } catch (error) {
    logger.error('Failed to register repository', {
      apiKeyId,
      github_url,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * List repositories for an API key
 */
export async function listRepositories(
  apiKeyId: string,
  options: {
    page?: number;
    limit?: number;
    status?: RepositoryStatus;
  } = {}
): Promise<{
  repositories: RepositoryResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
  try {
    const { page = 1, limit = 20, status } = options;
    const offset = (page - 1) * limit;

    // Build WHERE clause
    let whereClause = 'WHERE api_key_id = $1';
    const params: any[] = [apiKeyId];

    if (status) {
      whereClause += ' AND analysis_status = $2';
      params.push(status);
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM repositories ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Get repositories
    const result = await query<RepositoryRow>(
      `
      SELECT 
        id,
        github_url,
        owner,
        repo_name,
        default_branch,
        analysis_status,
        last_analyzed_at,
        created_at,
        metadata
      FROM repositories
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `,
      [...params, limit, offset]
    );

    const repositories: RepositoryResponse[] = result.rows.map((row) => ({
      id: row.id,
      githubUrl: row.github_url,
      owner: row.owner,
      repoName: row.repo_name,
      status: row.analysis_status as RepositoryStatus,
      lastAnalyzedAt: row.last_analyzed_at?.toISOString() || null,
      createdAt: row.created_at.toISOString(),
    }));

    return {
      repositories,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error('Failed to list repositories', {
      apiKeyId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Get repository by ID
 */
export async function getRepository(repositoryId: string, apiKeyId: string): Promise<Repository> {
  try {
    const result = await query<RepositoryRow>(
      `
      SELECT 
        id,
        api_key_id,
        github_url,
        owner,
        repo_name,
        default_branch,
        analysis_status,
        error_message,
        last_analyzed_at,
        created_at,
        updated_at,
        metadata
      FROM repositories
      WHERE id = $1
      `,
      [repositoryId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Repository');
    }

    const repository = result.rows[0]!;

    // Check ownership
    if (repository.api_key_id !== apiKeyId) {
      throw new AuthorizationError('You do not have access to this repository');
    }

    return {
      id: repository.id,
      apiKeyId: repository.api_key_id,
      githubUrl: repository.github_url,
      owner: repository.owner,
      repoName: repository.repo_name,
      defaultBranch: repository.default_branch,
      lastAnalyzedAt: repository.last_analyzed_at,
      analysisStatus: repository.analysis_status as RepositoryStatus,
      errorMessage: repository.error_message,
      createdAt: repository.created_at,
      updatedAt: repository.updated_at,
      metadata: repository.metadata || {},
    };
  } catch (error) {
    logger.error('Failed to get repository', {
      repositoryId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Delete repository
 */
export async function deleteRepository(repositoryId: string, apiKeyId: string): Promise<void> {
  try {
    const result = await query(
      `
      DELETE FROM repositories
      WHERE id = $1 AND api_key_id = $2
      RETURNING id
      `,
      [repositoryId, apiKeyId]
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Repository not found or does not belong to this API key');
    }

    logger.info('Repository deleted', {
      repositoryId,
      apiKeyId,
    });
  } catch (error) {
    logger.error('Failed to delete repository', {
      repositoryId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Update repository status
 */
export async function updateRepositoryStatus(
  repositoryId: string,
  status: RepositoryStatus,
  errorMessage?: string
): Promise<void> {
  try {
    await query(
      `
      UPDATE repositories
      SET 
        analysis_status = $1,
        error_message = $2,
        last_analyzed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE last_analyzed_at END,
        updated_at = NOW()
      WHERE id = $3
      `,
      [status, errorMessage || null, repositoryId]
    );

    logger.info('Repository status updated', {
      repositoryId,
      status,
    });
  } catch (error) {
    logger.error('Failed to update repository status', {
      repositoryId,
      status,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}
