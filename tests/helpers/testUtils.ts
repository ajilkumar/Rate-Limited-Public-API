jest.mock('@faker-js/faker');

import { faker } from '@faker-js/faker';
import { hashApiKey, generateApiKey } from '../../src/utils/apiKeyGenerator';
import { ApiKeyTier } from '../../src/types';
import { testPool, testRedis } from '../setup';


/**
 * Create test API key
 */
export async function createTestApiKey(options: {
  email?: string;
  tier?: ApiKeyTier;
  name?: string;
  isActive?: boolean;
} = {}) {
  const {
    email = faker.internet.email(),
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
    rawKey, // Return raw key for testing
  };
}

/**
 * Create test repository
 */
export async function createTestRepository(apiKeyId: string, options: {
  owner?: string;
  repoName?: string;
  githubUrl?: string;
  status?: string;
} = {}) {
  const {
    owner = faker.internet.username(),
    repoName = faker.lorem.slug(),
    githubUrl = `https://github.com/${owner}/${repoName}`,
    status = 'pending',
  } = options;

  const result = await testPool.query(
    `
    INSERT INTO repositories (
      api_key_id, github_url, owner, repo_name, analysis_status
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
    `,
    [apiKeyId, githubUrl, owner, repoName, status]
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
        faker.git.commitSha(),
        faker.person.fullName(),
        faker.internet.email(),
        faker.date.recent({ days: 30 }),
        faker.number.int({ min: 1, max: 10 }),
        faker.number.int({ min: 10, max: 500 }),
        faker.number.int({ min: 5, max: 200 }),
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
        faker.number.int({ min: 10, max: 500 }),
        faker.date.recent({ days: 7 }),
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
      value: faker.string.uuid(),
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
  await testPool.query('TRUNCATE api_usage, file_complexity, commit_metrics, repositories, api_keys CASCADE');
  await testRedis.flushDb();
}