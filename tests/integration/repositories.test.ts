import request from 'supertest';
import app from '../../src/app';
import { createTestApiKey, createTestRepository, cleanDatabase } from '../helpers/testUtils';
import nock from 'nock';

// Mock GitHub API responses
beforeAll(() => {
  // Mock GitHub API for repository validation
  nock('https://api.github.com')
    .persist()
    .get('/repos/facebook/react')
    .reply(200, {
      id: 10270250,
      name: 'react',
      full_name: 'facebook/react',
      owner: { login: 'facebook' },
      description: 'A declarative, efficient, and flexible JavaScript library',
      html_url: 'https://github.com/facebook/react',
      default_branch: 'main',
      private: false,
      stargazers_count: 220000,
      forks_count: 45000,
      language: 'JavaScript',
      topics: ['react', 'javascript'],
      license: { key: 'mit', name: 'MIT License' },
    });

  nock('https://api.github.com')
    .persist()
    .get('/repos/invalid/repo')
    .reply(404, { message: 'Not Found' });
});

afterAll(() => {
  nock.cleanAll();
});

describe('Repository Endpoints', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('POST /api/v1/repositories', () => {
    it('should register new repository', async () => {
      const { rawKey } = await createTestApiKey();

      const response = await request(app)
        .post('/api/v1/repositories')
        .set('Authorization', `Bearer ${rawKey}`)
        .send({
          github_url: 'https://github.com/facebook/react',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.githubUrl).toBe('https://github.com/facebook/react');
      expect(response.body.data.owner).toBe('facebook');
      expect(response.body.data.repoName).toBe('react');
      expect(response.body.data.status).toBe('pending');
    });

    it('should reject invalid GitHub URL', async () => {
      const { rawKey } = await createTestApiKey();

      await request(app)
        .post('/api/v1/repositories')
        .set('Authorization', `Bearer ${rawKey}`)
        .send({
          github_url: 'https://gitlab.com/test/repo',
        })
        .expect(400);
    });

    it('should reject non-existent repository', async () => {
      const { rawKey } = await createTestApiKey();

      const response = await request(app)
        .post('/api/v1/repositories')
        .set('Authorization', `Bearer ${rawKey}`)
        .send({
          github_url: 'https://github.com/invalid/repo',
        })
        .expect(404);

      expect(response.body.detail).toContain('not found');
    });

    it('should reject duplicate repository', async () => {
      const { rawKey } = await createTestApiKey();
      const url = 'https://github.com/facebook/react';

      // Register once
      await request(app)
        .post('/api/v1/repositories')
        .set('Authorization', `Bearer ${rawKey}`)
        .send({ github_url: url })
        .expect(201);

      // Try again
      await request(app)
        .post('/api/v1/repositories')
        .set('Authorization', `Bearer ${rawKey}`)
        .send({ github_url: url })
        .expect(409);
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/repositories')
        .send({
          github_url: 'https://github.com/facebook/react',
        })
        .expect(401);
    });
  });

  describe('GET /api/v1/repositories', () => {
    it('should list repositories', async () => {
      const { rawKey, id: apiKeyId } = await createTestApiKey();

      // Create test repositories
      await createTestRepository(apiKeyId, { owner: 'test1', repoName: 'repo1' });
      await createTestRepository(apiKeyId, { owner: 'test2', repoName: 'repo2' });

      const response = await request(app)
        .get('/api/v1/repositories')
        .set('Authorization', `Bearer ${rawKey}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination.total).toBe(2);
    });

    it('should support pagination', async () => {
      const { rawKey, id: apiKeyId } = await createTestApiKey();

      // Create 5 repositories
      for (let i = 0; i < 5; i++) {
        await createTestRepository(apiKeyId, { repoName: `repo${i}` });
      }

      const response = await request(app)
        .get('/api/v1/repositories?page=1&limit=2')
        .set('Authorization', `Bearer ${rawKey}`)
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(2);
      expect(response.body.pagination.total).toBe(5);
      expect(response.body.pagination.totalPages).toBe(3);
    });

    it('should filter by status', async () => {
      const { rawKey, id: apiKeyId } = await createTestApiKey();

      await createTestRepository(apiKeyId, { status: 'pending' });
      await createTestRepository(apiKeyId, { status: 'completed' });
      await createTestRepository(apiKeyId, { status: 'completed' });

      const response = await request(app)
        .get('/api/v1/repositories?status=completed')
        .set('Authorization', `Bearer ${rawKey}`)
        .expect(200);

      expect(response.body.data).toHaveLength(2);
    });

    it('should only show user repositories', async () => {
      const user1 = await createTestApiKey({ email: 'user1@example.com' });
      const user2 = await createTestApiKey({ email: 'user2@example.com' });

      await createTestRepository(user1.id, { repoName: 'user1-repo' });
      await createTestRepository(user2.id, { repoName: 'user2-repo' });

      const response = await request(app)
        .get('/api/v1/repositories')
        .set('Authorization', `Bearer ${user1.rawKey}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].repoName).toBe('user1-repo');
    });
  });

  describe('GET /api/v1/repositories/:id', () => {
    it('should get repository details', async () => {
      const { rawKey, id: apiKeyId } = await createTestApiKey();
      const repo = await createTestRepository(apiKeyId);

      const response = await request(app)
        .get(`/api/v1/repositories/${repo.id}`)
        .set('Authorization', `Bearer ${rawKey}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(repo.id);
      expect(response.body.data.owner).toBe(repo.owner);
    });

    it('should reject access to other user repository', async () => {
      const user1 = await createTestApiKey({ email: 'user1@example.com' });
      const user2 = await createTestApiKey({ email: 'user2@example.com' });

      const repo = await createTestRepository(user1.id);

      await request(app)
        .get(`/api/v1/repositories/${repo.id}`)
        .set('Authorization', `Bearer ${user2.rawKey}`)
        .expect(403);
    });

    it('should return 404 for non-existent repository', async () => {
      const { rawKey } = await createTestApiKey();
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await request(app)
        .get(`/api/v1/repositories/${fakeId}`)
        .set('Authorization', `Bearer ${rawKey}`)
        .expect(404);
    });

    it('should reject invalid UUID', async () => {
      const { rawKey } = await createTestApiKey();

      await request(app)
        .get('/api/v1/repositories/invalid-uuid')
        .set('Authorization', `Bearer ${rawKey}`)
        .expect(400);
    });
  });

  describe('DELETE /api/v1/repositories/:id', () => {
    it('should delete repository', async () => {
      const { rawKey, id: apiKeyId } = await createTestApiKey();
      const repo = await createTestRepository(apiKeyId);

      await request(app)
        .delete(`/api/v1/repositories/${repo.id}`)
        .set('Authorization', `Bearer ${rawKey}`)
        .expect(200);

      // Verify deletion
      await request(app)
        .get(`/api/v1/repositories/${repo.id}`)
        .set('Authorization', `Bearer ${rawKey}`)
        .expect(404);
    });

    it('should not allow deleting other user repository', async () => {
      const user1 = await createTestApiKey({ email: 'user1@example.com' });
      const user2 = await createTestApiKey({ email: 'user2@example.com' });

      const repo = await createTestRepository(user1.id);

      await request(app)
        .delete(`/api/v1/repositories/${repo.id}`)
        .set('Authorization', `Bearer ${user2.rawKey}`)
        .expect(404); // Not found (because it doesn't belong to user2)
    });
  });
});