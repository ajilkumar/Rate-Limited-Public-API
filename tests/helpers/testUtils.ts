import { testPool, testRedis } from '../setup';
import { hashApiKey, generateApiKey } from '../../src/utils/apiKeyGenerator';
import { ApiKeyTier } from '../../src/types';

// Simple counter for generating unique test data
let testCounter = 0;

/**
 * Create test API key
 */
export async function createTestApiKey(
  options: {
    email?: string;
    tier?: ApiKeyTier;
    name?: string;
    isActive?: boolean;
  } = {}
) {
  testCounter++;

  const {
    email = `test${testCounter}@example.com`,
    tier = ApiKeyTier.FREE,
    name = 'Test Key',
    isActive = true,
  } = options;

  const rawKey = generateApiKey(tier);
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = rawKey.substring(0, 12);

  const rateLimitPerHour = tier === ApiKeyTier.FREE ? 100 : tier === ApiKeyTier.PRO ? 1000 : 10000;

  const result = await testPool.query(
    `
    INSERT INTO api_keys (
      key_hash, key_prefix, user_email, name, tier, rate_limit_per_hour, is_active
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, key_hash, key_prefix, user_email, tier, rate_limit_per_hour, is_active, created_at
    `,
    [keyHash, keyPrefix, email, name, tier, rateLimitPerHour, isActive]
  );

  return {
    ...result.rows[0],
    email: result.rows[0].user_email, // 👈 ADD THIS
    rawKey, // Return raw key for testing
  };
}

/**
 * Create test repository
 */
export async function createTestRepository(
  apiKeyId: string,
  options: {
    owner?: string;
    repoName?: string;
    githubUrl?: string;
    status?: string;
  } = {}
) {
  testCounter++;

  const {
    owner = `testowner${testCounter}`,
    repoName = `testrepo${testCounter}`,
    githubUrl,
    status = 'pending',
  } = options;

  const url = githubUrl || `https://github.com/${owner}/${repoName}`;

  const result = await testPool.query(
    `
    INSERT INTO repositories (
      api_key_id, github_url, owner, repo_name, analysis_status
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
    `,
    [apiKeyId, url, owner, repoName, status]
  );

  return result.rows[0];
}

/**
 * Create test commits
 */
export async function createTestCommits(repositoryId: string, count: number = 10) {
  const commits = [];

  for (let i = 0; i < count; i++) {
    const result = await testPool.query(
      `
      INSERT INTO commit_metrics (
        repository_id, commit_sha, author_name, author_email, 
        commit_date, files_changed, lines_added, lines_deleted
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
      `,
      [
        repositoryId,
        `sha${Date.now()}${i}${Math.random().toString(36).substring(7)}`,
        `Test Author ${i}`,
        `author${i}@example.com`,
        new Date(Date.now() - i * 24 * 60 * 60 * 1000), // i days ago
        Math.floor(Math.random() * 10) + 1,
        Math.floor(Math.random() * 500) + 10,
        Math.floor(Math.random() * 200) + 5,
      ]
    );

    commits.push(result.rows[0]);
  }

  return commits;
}

/**
 * Create test API usage logs
 */
export async function createTestUsageLogs(apiKeyId: string, count: number = 5) {
  const logs = [];

  for (let i = 0; i < count; i++) {
    const result = await testPool.query(
      `
      INSERT INTO api_usage (
        api_key_id, endpoint, method, status_code, 
        response_time_ms, timestamp
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [
        apiKeyId,
        '/api/v1/auth/me',
        'GET',
        200,
        Math.floor(Math.random() * 500) + 10,
        new Date(Date.now() - i * 60 * 60 * 1000), // i hours ago
      ]
    );

    logs.push(result.rows[0]);
  }

  return logs;
}

/**
 * Simulate Redis rate limit entries
 */
export async function simulateRateLimitUsage(apiKeyId: string, requestCount: number) {
  const now = Date.now();
  const key = `ratelimit:${apiKeyId}`;

  for (let i = 0; i < requestCount; i++) {
    await testRedis.zAdd(key, {
      score: now - i * 1000, // 1 second apart
      value: `request-${Date.now()}-${i}-${Math.random()}`,
    });
  }

  await testRedis.expire(key, 3600);
}

/**
 * Wait for async operations
 */
export async function waitFor(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Clean all test data
 */
export async function cleanDatabase() {
  await testPool.query(
    'TRUNCATE api_usage, file_complexity, commit_metrics, repositories, api_keys CASCADE'
  );
  await testRedis.flushDb();
}
