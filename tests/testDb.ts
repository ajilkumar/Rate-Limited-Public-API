import { Pool } from 'pg';
import { createClient } from 'redis';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Global test database pool
export const testPool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
});

// Global test Redis client
export const testRedis = createClient({
  url: process.env.TEST_REDIS_URL,
});

export async function connectTestDb() {
    await testRedis.connect();
}

export async function disconnectTestDb() {
    await testPool.end();
    await testRedis.quit();
}

export async function cleanTestDatabase() {
  // Truncate all tables in reverse order (respect foreign keys)
  await testPool.query('TRUNCATE api_usage, file_complexity, commit_metrics, repositories, api_keys CASCADE');
  
  // Clear Redis
  await testRedis.flushDb();
}
