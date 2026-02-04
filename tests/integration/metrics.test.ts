import request from 'supertest';
import app from '../../src/app';
import {
  createTestApiKey,
  createTestRepository,
  createTestCommits,
  cleanDatabase,
} from '../helpers/testUtils';

describe('Metrics Endpoints', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('POST /api/v1/repositories/:id/metrics/analyze', () => {
    it('should trigger repository analysis', async () => {
      const { rawKey, id: apiKeyId } = await createTestApiKey();
      const repo = await createTestRepository(apiKeyId);

      const response = await request(app)
        .post(`/api/v1/repositories/${repo.id}/metrics/analyze`)
        .set('Authorization', `Bearer ${rawKey}`)
        .expect(202);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('started');
      expect(response.body.data.status).toBe('processing');
    });

    it('should handle already analyzed repository', async () => {
      const { rawKey, id: apiKeyId } = await createTestApiKey();
      const repo = await createTestRepository(apiKeyId, { status: 'completed' });

      // Add some commits to simulate analysis
      await createTestCommits(repo.id, 5);

      const response = await request(app)
        .post(`/api/v1/repositories/${repo.id}/metrics/analyze`)
        .set('Authorization', `Bearer ${rawKey}`)
        .expect(200);

      expect(response.body.message).toContain('already analyzed');
    });
  });

  describe('GET /api/v1/repositories/:id/metrics/summary', () => {
    it('should return repository summary', async () => {
      const { rawKey, id: apiKeyId } = await createTestApiKey();
      const repo = await createTestRepository(apiKeyId, { status: 'completed' });
      await createTestCommits(repo.id, 50);

      const response = await request(app)
        .get(`/api/v1/repositories/${repo.id}/metrics/summary`)
        .set('Authorization', `Bearer ${rawKey}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.overview.totalCommits).toBe(50);
      expect(response.body.data.overview.totalContributors).toBeGreaterThan(0);
      expect(response.body.data.overview.dateRange.firstCommit).toBeDefined();
    });

    it('should cache summary data', async () => {
      const { rawKey, id: apiKeyId } = await createTestApiKey();
      const repo = await createTestRepository(apiKeyId);
      await createTestCommits(repo.id, 10);

      // First request
      const start1 = Date.now();
      await request(app)
        .get(`/api/v1/repositories/${repo.id}/metrics/summary`)
        .set('Authorization', `Bearer ${rawKey}`)
        .expect(200);
      const duration1 = Date.now() - start1;

      // Second request (cached)
      const start2 = Date.now();
      await request(app)
        .get(`/api/v1/repositories/${repo.id}/metrics/summary`)
        .set('Authorization', `Bearer ${rawKey}`)
        .expect(200);
      const duration2 = Date.now() - start2;

      // Cached request should be faster
      expect(duration2).toBeLessThan(duration1);
    });
  });

  describe('GET /api/v1/repositories/:id/metrics/commits', () => {
    it('should return commit frequency metrics', async () => {
      const { rawKey, id: apiKeyId } = await createTestApiKey();
      const repo = await createTestRepository(apiKeyId);
      await createTestCommits(repo.id, 30);

      const response = await request(app)
        .get(`/api/v1/repositories/${repo.id}/metrics/commits?period=30d`)
        .set('Authorization', `Bearer ${rawKey}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.repositoryId).toBe(repo.id);
      expect(response.body.data.period).toBe('30d');
      expect(response.body.data.totalCommits).toBe(30);
      expect(response.body.data.commitsByDay).toBeDefined();
      expect(response.body.data.commitsByAuthor).toBeDefined();
    });

    it('should support different time periods', async () => {
      const { rawKey, id: apiKeyId } = await createTestApiKey();
      const repo = await createTestRepository(apiKeyId);
      await createTestCommits(repo.id, 20);

      const periods = ['24h', '7d', '30d', '90d', '1y', 'all'];

      for (const period of periods) {
        const response = await request(app)
          .get(`/api/v1/repositories/${repo.id}/metrics/commits?period=${period}`)
          .set('Authorization', `Bearer ${rawKey}`)
          .expect(200);

        expect(response.body.data.period).toBe(period);
      }
    });
  });

  describe('GET /api/v1/repositories/:id/metrics/contributors', () => {
    it('should return contributor metrics', async () => {
      const { rawKey, id: apiKeyId } = await createTestApiKey();
      const repo = await createTestRepository(apiKeyId);
      await createTestCommits(repo.id, 25);

      const response = await request(app)
        .get(`/api/v1/repositories/${repo.id}/metrics/contributors?period=30d&limit=5`)
        .set('Authorization', `Bearer ${rawKey}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalContributors).toBeGreaterThan(0);
      expect(response.body.data.topContributors).toBeDefined();
      expect(response.body.data.topContributors.length).toBeLessThanOrEqual(5);
    });

    it('should order contributors by commit count', async () => {
      const { rawKey, id: apiKeyId } = await createTestApiKey();
      const repo = await createTestRepository(apiKeyId);
      await createTestCommits(repo.id, 20);

      const response = await request(app)
        .get(`/api/v1/repositories/${repo.id}/metrics/contributors?limit=10`)
        .set('Authorization', `Bearer ${rawKey}`)
        .expect(200);

      const contributors = response.body.data.topContributors;

      // Check that contributors are ordered by commit count (descending)
      for (let i = 0; i < contributors.length - 1; i++) {
        expect(contributors[i].commits).toBeGreaterThanOrEqual(contributors[i + 1].commits);
      }
    });
  });

  describe('GET /api/v1/repositories/:id/metrics/activity', () => {
    it('should return activity metrics', async () => {
      const { rawKey, id: apiKeyId } = await createTestApiKey();
      const repo = await createTestRepository(apiKeyId);
      await createTestCommits(repo.id, 15);

      const response = await request(app)
        .get(`/api/v1/repositories/${repo.id}/metrics/activity?period=7d`)
        .set('Authorization', `Bearer ${rawKey}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalCommits).toBeGreaterThan(0);
      expect(response.body.data.totalLinesAdded).toBeGreaterThan(0);
      expect(response.body.data.totalLinesDeleted).toBeGreaterThan(0);
      expect(response.body.data.mostActiveDay).toBeDefined();
      expect(response.body.data.mostActiveHour).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Authorization', () => {
    it('should not allow accessing other user metrics', async () => {
      const user1 = await createTestApiKey({ email: 'user1@example.com' });
      const user2 = await createTestApiKey({ email: 'user2@example.com' });

      const repo = await createTestRepository(user1.id);

      await request(app)
        .get(`/api/v1/repositories/${repo.id}/metrics/summary`)
        .set('Authorization', `Bearer ${user2.rawKey}`)
        .expect(403);
    });
  });
});