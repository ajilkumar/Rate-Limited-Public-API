import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
// import dotenv from 'dotenv';
import { env } from '../src/config/env';

// dotenv.config();
const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

interface Migration {
  version: number;
  filename: string;
  sql: string;
}

/**
 * Initialize migrations table
 */
async function initMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      filename VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('Migrations table initialized');
}

/**
 * Get applied migrations
 */
async function getAppliedMigrations(): Promise<Set<number>> {
  const result = await pool.query('SELECT version FROM schema_migrations ORDER BY version');
  return new Set(result.rows.map((row) => row.version));
}

/**
 * Get pending migrations
 */
function getPendingMigrations(appliedVersions: Set<number>): Migration[] {
  const migrationsDir = __dirname;
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const migrations: Migration[] = [];

  for (const file of files) {
    // Split filename and get first part
    const parts = file.split('_');
    const versionStr = parts[0];

    // Skip if no version part exists
    if (!versionStr) {
      console.warn(`Skipping invalid migration file: ${file}`);
      continue;
    }

    const version = parseInt(versionStr, 10);

    if (isNaN(version)) {
      console.warn(`Skipping invalid migration file: ${file}`);
      continue;
    }

    if (!appliedVersions.has(version)) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      migrations.push({ version, filename: file, sql });
    }
  }

  return migrations;
}

/**
 * Apply a single migration
 */
async function applyMigration(migration: Migration): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log(`Applying migration: ${migration.filename}`);

    // Execute migration SQL
    await client.query(migration.sql);

    // Record migration
    await client.query('INSERT INTO schema_migrations (version, filename) VALUES ($1, $2)', [
      migration.version,
      migration.filename,
    ]);

    await client.query('COMMIT');
    console.log(`Applied migration: ${migration.filename}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Failed to apply migration: ${migration.filename}`);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Run all pending migrations
 */
async function runMigrations(): Promise<void> {
  try {
    console.log('Starting database migrations...\n');

    // Initialize migrations table
    await initMigrationsTable();

    // Get applied migrations
    const appliedVersions = await getAppliedMigrations();
    console.log(`Applied migrations: ${appliedVersions.size}`);

    // Get pending migrations
    const pendingMigrations = getPendingMigrations(appliedVersions);

    if (pendingMigrations.length === 0) {
      console.log('\nDatabase is up to date! No migrations to apply.');
      return;
    }

    console.log(`Pending migrations: ${pendingMigrations.length}\n`);

    // Apply each pending migration
    for (const migration of pendingMigrations) {
      await applyMigration(migration);
    }

    console.log('\n All migrations applied successfully!');
  } catch (error) {
    console.error('\n Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migrations
runMigrations().catch((error) => {
  console.error(error);
  process.exit(1);
});
