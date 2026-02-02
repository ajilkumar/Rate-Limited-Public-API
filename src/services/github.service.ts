import { ExternalServiceError, NotFoundError, ValidationError } from '../utils/errors';
import logger from '../config/logger';
import { env } from '../config/env';

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    type: string;
  };
  description: string | null;
  html_url: string;
  default_branch: string;
  private: boolean;
  fork: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  topics: string[];
  license: {
    key: string;
    name: string;
  } | null;
}

interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  stats?: {
    total: number;
    additions: number;
    deletions: number;
  };
  files?: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
  }>;
}

/**
 * Parse GitHub URL to extract owner and repo name
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } {
  try {
    // Match: https://github.com/owner/repo or https://github.com/owner/repo.git
    const regex = /github\.com\/([^\/]+)\/([^\/\.]+)/;
    const match = url.match(regex);

    if (!match) {
      throw new ValidationError('Invalid GitHub URL format');
    }

    const owner = match[1]!;
    const repo = match[2]!;

    return { owner, repo };
  } catch (error) {
    throw new ValidationError('Failed to parse GitHub URL');
  }
}

/**
 * Fetch repository information from GitHub API
 */
export async function fetchRepoInfo(owner: string, repo: string): Promise<GitHubRepo> {
  try {
    const url = `${env.GITHUB_API_URL}/repos/${owner}/${repo}`;

    logger.debug('Fetching GitHub repository info', { owner, repo });

    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        'User-Agent': 'DevMetrics-API',
      },
    });

    // Check rate limit headers
    const rateLimit = response.headers.get('x-ratelimit-remaining');
    const rateLimitReset = response.headers.get('x-ratelimit-reset');

    logger.debug('GitHub API rate limit', {
      remaining: rateLimit,
      resetAt: rateLimitReset ? new Date(parseInt(rateLimitReset) * 1000).toISOString() : 'unknown',
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new NotFoundError('Repository not found on GitHub');
      }

      if (response.status === 403) {
        const resetTime = rateLimitReset
          ? new Date(parseInt(rateLimitReset) * 1000).toISOString()
          : 'unknown';
        throw new ExternalServiceError('GitHub', `Rate limit exceeded. Resets at ${resetTime}`);
      }

      throw new ExternalServiceError('GitHub', `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as GitHubRepo;

    logger.info('GitHub repository info fetched successfully', {
      owner,
      repo,
      stars: data.stargazers_count,
      language: data.language,
    });

    return data;
  } catch (error) {
    if (
      error instanceof NotFoundError ||
      error instanceof ExternalServiceError ||
      error instanceof ValidationError
    ) {
      throw error;
    }

    logger.error('Failed to fetch GitHub repository info', {
      owner,
      repo,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new ExternalServiceError('GitHub', 'Failed to fetch repository information');
  }
}

/**
 * Fetch commits from GitHub repository
 */
export async function fetchCommits(
  owner: string,
  repo: string,
  options: {
    since?: Date;
    until?: Date;
    page?: number;
    perPage?: number;
  } = {}
): Promise<GitHubCommit[]> {
  try {
    const { since, until, page = 1, perPage = 100 } = options;

    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
    });

    if (since) {
      params.append('since', since.toISOString());
    }

    if (until) {
      params.append('until', until.toISOString());
    }

    const url = `${env.GITHUB_API_URL}/repos/${owner}/${repo}/commits?${params}`;

    logger.debug('Fetching GitHub commits', { owner, repo, page, perPage });

    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        'User-Agent': 'DevMetrics-API',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new NotFoundError('Repository not found on GitHub');
      }

      if (response.status === 409) {
        // Empty repository
        logger.info('Repository is empty (no commits)', { owner, repo });
        return [];
      }

      throw new ExternalServiceError('GitHub', `HTTP ${response.status}: ${response.statusText}`);
    }

    const commits = (await response.json()) as GitHubCommit[];

    logger.info('GitHub commits fetched successfully', {
      owner,
      repo,
      count: commits.length,
      page,
    });

    return commits;
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ExternalServiceError) {
      throw error;
    }

    logger.error('Failed to fetch GitHub commits', {
      owner,
      repo,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new ExternalServiceError('GitHub', 'Failed to fetch commits');
  }
}

/**
 * Fetch detailed commit information (includes file changes)
 */
export async function fetchCommitDetails(
  owner: string,
  repo: string,
  sha: string
): Promise<GitHubCommit> {
  try {
    const url = `${env.GITHUB_API_URL}/repos/${owner}/${repo}/commits/${sha}`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        'User-Agent': 'DevMetrics-API',
      },
    });

    if (!response.ok) {
      throw new ExternalServiceError('GitHub', `HTTP ${response.status}: ${response.statusText}`);
    }

    return (await response.json()) as GitHubCommit;
  } catch (error) {
    logger.error('Failed to fetch commit details', {
      owner,
      repo,
      sha,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new ExternalServiceError('GitHub', 'Failed to fetch commit details');
  }
}

/**
 * Validate that repository is accessible
 */
export async function validateRepoAccess(githubUrl: string): Promise<{
  valid: boolean;
  owner: string;
  repo: string;
  repoInfo?: GitHubRepo;
  error?: string;
}> {
  try {
    const { owner, repo } = parseGitHubUrl(githubUrl);
    const repoInfo = await fetchRepoInfo(owner, repo);

    // Check if repo is private (our API only supports public repos for now)
    if (repoInfo.private) {
      return {
        valid: false,
        owner,
        repo,
        error: 'Private repositories are not supported yet',
      };
    }

    return {
      valid: true,
      owner,
      repo,
      repoInfo,
    };
  } catch (error) {
    const { owner, repo } = parseGitHubUrl(githubUrl);
    return {
      valid: false,
      owner,
      repo,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
