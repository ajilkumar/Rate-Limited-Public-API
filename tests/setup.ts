import { Pool } from 'pg';
import { createClient } from 'redis';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Global test database pool
let testPool: Pool;
let testRedis: ReturnType<typeof createClient>;

beforeAll(async () => {
  // Create test database pool
  testPool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL,
  });

  // Create test Redis client
  testRedis = createClient({
    url: process.env.TEST_REDIS_URL,
  });
  await testRedis.connect();

  // Run migrations on test database
  await runTestMigrations();
});

afterAll(async () => {
  // Close connections with proper error handling
  try {
    await testPool.end();
  } catch (error) {
    console.error('Error closing test pool:', error);
  }
  
  try {
    await testRedis.quit();
  } catch (error) {
    console.error('Error closing Redis:', error);
  }
}, 10000); // Increase timeout for cleanup

// Clean database before each test
beforeEach(async () => {
  await cleanTestDatabase();
});

async function runTestMigrations() {
  // Check if tables already exist (prevents running migrations multiple times)
  const checkResult = await testPool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'api_keys'
    );
  `);
  
  if (checkResult.rows[0].exists) {
    // Tables already exist, skip migrations
    return;
  }
  
  // Read and execute migration files
  const fs = require('fs');
  const path = require('path');
  
  const migrationsDir = path.join(__dirname, '../migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter((f: string) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (file === 'migrate.ts') continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await testPool.query(sql);
  }
}

async function cleanTestDatabase() {
  // Truncate all tables in reverse order (respect foreign keys)
  await testPool.query('TRUNCATE api_usage, file_complexity, commit_metrics, repositories, api_keys CASCADE');
  
  // Clear Redis
  await testRedis.flushDb();
}

// Export for use in tests
export { testPool, testRedis };