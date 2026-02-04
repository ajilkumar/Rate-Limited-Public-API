import { query } from '../config/database';
import { setex, get } from '../config/redis';
import { CACHE_TTL, QUERY_PERIODS } from '../utils/constants';
import logger from '../config/logger';
import { QueryPeriod } from '../types';

interface CommitFrequencyMetrics {
  repositoryId: string;
  period: QueryPeriod;
  totalCommits: number;
  commitsByDay: Array<{ date: string; commits: number; uniqueAuthors: number }>;
  commitsByAuthor: Record<string, number>;
  averageCommitsPerDay: number;
}

interface ContributorMetrics {
  repositoryId: string;
  period: QueryPeriod;
  totalContributors: number;
  topContributors: Array<{
    name: string;
    email: string;
    commits: number;
    linesAdded: number;
    linesDeleted: number;
  }>;
}

interface ActivityMetrics {
  repositoryId: string;
  period: QueryPeriod;
  totalCommits: number;
  totalLinesAdded: number;
  totalLinesDeleted: number;
  totalFilesChanged: number;
  mostActiveDay: string;
  mostActiveHour: number;
}

/**
 * Get commit frequency metrics
 */
export async function getCommitFrequencyMetrics(
  repositoryId: string,
  period: QueryPeriod = '30d'
): Promise<CommitFrequencyMetrics> {
  const cacheKey = `cache:metrics:${repositoryId}:commit-frequency:${period}`;

  try {
    // Check cache
    const cached = await get<CommitFrequencyMetrics>(cacheKey);
    if (cached) {
      logger.debug('Cache hit for commit frequency metrics', { repositoryId, period });
      return cached;
    }

    // Calculate time range
    const timeRange = getTimeRange(period);

    // Get commits by day
    const dayResult = await query(
      `
      SELECT 
        DATE(commit_date) as day,
        COUNT(*) as commits,
        COUNT(DISTINCT author_email) as unique_authors
      FROM commit_metrics
      WHERE repository_id = $1
        AND commit_date >= $2
      GROUP BY DATE(commit_date)
      ORDER BY day DESC
      `,
      [repositoryId, timeRange]
    );

    // Get commits by author
    const authorResult = await query(
      `
      SELECT 
        author_email,
        COUNT(*) as commits
      FROM commit_metrics
      WHERE repository_id = $1
        AND commit_date >= $2
      GROUP BY author_email
      ORDER BY commits DESC
      `,
      [repositoryId, timeRange]
    );

    // Get total commits
    const totalResult = await query(
      `
      SELECT COUNT(*) as total
      FROM commit_metrics
      WHERE repository_id = $1
        AND commit_date >= $2
      `,
      [repositoryId, timeRange]
    );

    const totalCommits = parseInt(totalResult.rows[0].total);
    const dayCount = dayResult.rows.length || 1;

    const metrics: CommitFrequencyMetrics = {
      repositoryId,
      period,
      totalCommits,
      commitsByDay: dayResult.rows.map((row) => ({
        date: row.day.toISOString().split('T')[0],
        commits: parseInt(row.commits),
        uniqueAuthors: parseInt(row.unique_authors),
      })),
      commitsByAuthor: authorResult.rows.reduce(
        (acc, row) => {
          acc[row.author_email] = parseInt(row.commits);
          return acc;
        },
        {} as Record<string, number>
      ),
      averageCommitsPerDay: Math.round((totalCommits / dayCount) * 10) / 10,
    };

    // Cache the result
    await setex(cacheKey, metrics, CACHE_TTL.MEDIUM);

    return metrics;
  } catch (error) {
    logger.error('Failed to get commit frequency metrics', {
      repositoryId,
      period,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Get contributor metrics
 */
export async function getContributorMetrics(
  repositoryId: string,
  period: QueryPeriod = '30d',
  limit: number = 10
): Promise<ContributorMetrics> {
  const cacheKey = `cache:metrics:${repositoryId}:contributors:${period}:${limit}`;

  try {
    // Check cache
    const cached = await get<ContributorMetrics>(cacheKey);
    if (cached) {
      logger.debug('Cache hit for contributor metrics', { repositoryId, period });
      return cached;
    }

    // Calculate time range
    const timeRange = getTimeRange(period);

    // Get contributor stats
    const result = await query(
      `
      SELECT 
        author_name,
        author_email,
        COUNT(*) as commits,
        SUM(lines_added) as lines_added,
        SUM(lines_deleted) as lines_deleted
      FROM commit_metrics
      WHERE repository_id = $1
        AND commit_date >= $2
      GROUP BY author_name, author_email
      ORDER BY commits DESC
      LIMIT $3
      `,
      [repositoryId, timeRange, limit]
    );

    // Get total unique contributors
    const countResult = await query(
      `
      SELECT COUNT(DISTINCT author_email) as total
      FROM commit_metrics
      WHERE repository_id = $1
        AND commit_date >= $2
      `,
      [repositoryId, timeRange]
    );

    const metrics: ContributorMetrics = {
      repositoryId,
      period,
      totalContributors: parseInt(countResult.rows[0].total),
      topContributors: result.rows.map((row) => ({
        name: row.author_name,
        email: row.author_email,
        commits: parseInt(row.commits),
        linesAdded: parseInt(row.lines_added) || 0,
        linesDeleted: parseInt(row.lines_deleted) || 0,
      })),
    };

    // Cache the result
    await setex(cacheKey, metrics, CACHE_TTL.MEDIUM);

    return metrics;
  } catch (error) {
    logger.error('Failed to get contributor metrics', {
      repositoryId,
      period,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Get activity metrics
 */
export async function getActivityMetrics(
  repositoryId: string,
  period: QueryPeriod = '30d'
): Promise<ActivityMetrics> {
  const cacheKey = `cache:metrics:${repositoryId}:activity:${period}`;

  try {
    // Check cache
    const cached = await get<ActivityMetrics>(cacheKey);
    if (cached) {
      logger.debug('Cache hit for activity metrics', { repositoryId, period });
      return cached;
    }

    // Calculate time range
    const timeRange = getTimeRange(period);

    // Get totals
    const totalsResult = await query(
      `
      SELECT 
        COUNT(*) as total_commits,
        SUM(lines_added) as total_lines_added,
        SUM(lines_deleted) as total_lines_deleted,
        SUM(files_changed) as total_files_changed
      FROM commit_metrics
      WHERE repository_id = $1
        AND commit_date >= $2
      `,
      [repositoryId, timeRange]
    );

    // Get most active day
    const dayResult = await query(
      `
      SELECT 
        DATE(commit_date) as day,
        COUNT(*) as commits
      FROM commit_metrics
      WHERE repository_id = $1
        AND commit_date >= $2
      GROUP BY DATE(commit_date)
      ORDER BY commits DESC
      LIMIT 1
      `,
      [repositoryId, timeRange]
    );

    // Get most active hour
    const hourResult = await query(
      `
      SELECT 
        EXTRACT(HOUR FROM commit_date) as hour,
        COUNT(*) as commits
      FROM commit_metrics
      WHERE repository_id = $1
        AND commit_date >= $2
      GROUP BY EXTRACT(HOUR FROM commit_date)
      ORDER BY commits DESC
      LIMIT 1
      `,
      [repositoryId, timeRange]
    );

    const totals = totalsResult.rows[0];

    const metrics: ActivityMetrics = {
      repositoryId,
      period,
      totalCommits: parseInt(totals.total_commits) || 0,
      totalLinesAdded: parseInt(totals.total_lines_added) || 0,
      totalLinesDeleted: parseInt(totals.total_lines_deleted) || 0,
      totalFilesChanged: parseInt(totals.total_files_changed) || 0,
      mostActiveDay: dayResult.rows[0]?.day.toISOString().split('T')[0] || 'N/A',
      mostActiveHour: parseInt(hourResult.rows[0]?.hour) || 0,
    };

    // Cache the result
    await setex(cacheKey, metrics, CACHE_TTL.MEDIUM);

    return metrics;
  } catch (error) {
    logger.error('Failed to get activity metrics', {
      repositoryId,
      period,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Get comprehensive repository summary
 */
export async function getRepositorySummary(repositoryId: string): Promise<{
  overview: {
    totalCommits: number;
    totalContributors: number;
    dateRange: {
      firstCommit: string;
      lastCommit: string;
    };
  };
  recent: {
    last7Days: number;
    last30Days: number;
  };
  topLanguage: string | null;
}> {
  const cacheKey = `cache:metrics:${repositoryId}:summary`;

  try {
    // Check cache
    const cached = await get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    // Get overview
    const overviewResult = await query(
      `
      SELECT 
        COUNT(*) as total_commits,
        COUNT(DISTINCT author_email) as total_contributors,
        MIN(commit_date) as first_commit,
        MAX(commit_date) as last_commit
      FROM commit_metrics
      WHERE repository_id = $1
      `,
      [repositoryId]
    );

    // Get recent activity
    const recentResult = await query(
      `
      SELECT 
        COUNT(*) FILTER (WHERE commit_date >= NOW() - INTERVAL '7 days') as last_7_days,
        COUNT(*) FILTER (WHERE commit_date >= NOW() - INTERVAL '30 days') as last_30_days
      FROM commit_metrics
      WHERE repository_id = $1
      `,
      [repositoryId]
    );

    // Get repository metadata (language)
    const repoResult = await query(`SELECT metadata FROM repositories WHERE id = $1`, [
      repositoryId,
    ]);

    const overview = overviewResult.rows[0];
    const recent = recentResult.rows[0];
    const metadata = repoResult.rows[0]?.metadata || {};

    const summary = {
      overview: {
        totalCommits: parseInt(overview.total_commits) || 0,
        totalContributors: parseInt(overview.total_contributors) || 0,
        dateRange: {
          firstCommit: overview.first_commit?.toISOString() || 'N/A',
          lastCommit: overview.last_commit?.toISOString() || 'N/A',
        },
      },
      recent: {
        last7Days: parseInt(recent.last_7_days) || 0,
        last30Days: parseInt(recent.last_30_days) || 0,
      },
      topLanguage: metadata.language || null,
    };

    // Cache for longer since it's summary data
    await setex(cacheKey, summary, CACHE_TTL.LONG);

    return summary;
  } catch (error) {
    logger.error('Failed to get repository summary', {
      repositoryId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Helper: Calculate time range based on period
 */
function getTimeRange(period: QueryPeriod): Date {
  const now = new Date();
  const periodMs = QUERY_PERIODS[period];

  if (periodMs === Infinity) {
    // 'all' - return a date far in the past
    return new Date('1970-01-01');
  }

  return new Date(now.getTime() - periodMs);
}
