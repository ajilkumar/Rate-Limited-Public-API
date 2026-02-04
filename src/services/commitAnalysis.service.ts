import { query } from '../config/database';
import { fetchCommits } from './github.service';
import { updateRepositoryStatus } from './repository.service';
import { RepositoryStatus } from '../types';
import logger from '../config/logger';
import { env } from '../config/env';

interface CommitData {
  repositoryId: string;
  commitSha: string;
  authorName: string;
  authorEmail: string;
  commitDate: Date;
  filesChanged: number;
  linesAdded: number;
  linesDeleted: number;
  message: string;
}

/**
 * Analyze repository commits
 * This would normally run as a background job
 */
async function analyzeRepositoryCommits(repositoryId: string): Promise<void> {
  try {
    logger.info('Starting commit analysis', { repositoryId });

    // Update status to processing
    await updateRepositoryStatus(repositoryId, RepositoryStatus.PROCESSING);

    // Get repository info
    const repoResult = await query(
      `SELECT owner, repo_name, github_url FROM repositories WHERE id = $1`,
      [repositoryId]
    );

    if (repoResult.rows.length === 0) {
      throw new Error('Repository not found');
    }

    const { owner, repo_name } = repoResult.rows[0];

    // Fetch commits from GitHub (last 1000 commits or 1 year)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    let allCommits: CommitData[] = [];
    let page = 1;
    const perPage = 100;
    const maxCommits = env.MAX_COMMITS_TO_ANALYZE || 1000;

    while (allCommits.length < maxCommits) {
      const commits = await fetchCommits(owner, repo_name, {
        since: oneYearAgo,
        page,
        perPage,
      });

      if (commits.length === 0) {
        break; // No more commits
      }

      // Transform commits to our format
      const transformedCommits: CommitData[] = commits.map((commit) => ({
        repositoryId,
        commitSha: commit.sha,
        authorName: commit.commit.author.name,
        authorEmail: commit.commit.author.email,
        commitDate: new Date(commit.commit.author.date),
        filesChanged: commit.stats?.total || 0,
        linesAdded: commit.stats?.additions || 0,
        linesDeleted: commit.stats?.deletions || 0,
        message: commit.commit.message,
      }));

      allCommits = allCommits.concat(transformedCommits);

      logger.debug('Fetched commits page', {
        repositoryId,
        page,
        count: commits.length,
        total: allCommits.length,
      });

      page++;

      // Respect GitHub rate limits
      if (commits.length < perPage) {
        break; // Last page
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    logger.info('Fetched all commits', {
      repositoryId,
      totalCommits: allCommits.length,
    });

    // Store commits in database (batch insert)
    if (allCommits.length > 0) {
      await batchInsertCommits(allCommits);
    }

    // Update status to completed
    await updateRepositoryStatus(repositoryId, RepositoryStatus.COMPLETED);

    logger.info('Commit analysis completed successfully', {
      repositoryId,
      totalCommits: allCommits.length,
    });
  } catch (error) {
    logger.error('Commit analysis failed', {
      repositoryId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Update status to failed
    await updateRepositoryStatus(
      repositoryId,
      RepositoryStatus.FAILED,
      error instanceof Error ? error.message : 'Unknown error'
    );

    throw error;
  }
}

/**
 * Batch insert commits for performance
 */
async function batchInsertCommits(commits: CommitData[]): Promise<void> {
  const batchSize = 100;

  for (let i = 0; i < commits.length; i += batchSize) {
    const batch = commits.slice(i, i + batchSize);

    // Build VALUES clause for batch insert
    const values: any[] = [];
    const placeholders: string[] = [];

    batch.forEach((commit, index) => {
      const baseIndex = index * 8;
      placeholders.push(
        `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8})`
      );
      values.push(
        commit.repositoryId,
        commit.commitSha,
        commit.authorName,
        commit.authorEmail,
        commit.commitDate,
        commit.filesChanged,
        commit.linesAdded,
        commit.linesDeleted
      );
    });

    // Use ON CONFLICT to skip duplicates
    await query(
      `
      INSERT INTO commit_metrics (
        repository_id,
        commit_sha,
        author_name,
        author_email,
        commit_date,
        files_changed,
        lines_added,
        lines_deleted
      )
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (repository_id, commit_sha) DO NOTHING
      `,
      values
    );

    logger.debug('Batch inserted commits', {
      batch: Math.floor(i / batchSize) + 1,
      count: batch.length,
    });
  }
}

/**
 * Get commit count for a repository
 */
export async function getCommitCount(repositoryId: string): Promise<number> {
  const result = await query(
    `SELECT COUNT(*) as count FROM commit_metrics WHERE repository_id = $1`,
    [repositoryId]
  );
  return parseInt(result.rows[0].count);
}

/**
 * Trigger analysis for a repository
 */
export async function triggerAnalysis(repositoryId: string): Promise<void> {
  // In production, this would enqueue a background job
  // For now, we'll run it synchronously (with a warning)
  logger.warn('Running analysis synchronously - in production, use a job queue', {
    repositoryId,
  });

  // Run analysis in background (don't await)
  analyzeRepositoryCommits(repositoryId).catch((error) => {
    logger.error('Background analysis failed', {
      repositoryId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  });
}
