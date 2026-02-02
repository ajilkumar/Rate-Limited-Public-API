import { Router } from 'express';
import authRoutes from './auth.routes';
import repositoryRoutes from './repository.routes';

const router = Router();

// Import route modules (we'll create these in Phase 2)
// import authRoutes from './auth.routes';
// import repositoryRoutes from './repository.routes';
// import metricsRoutes from './metrics.routes';
// import usageRoutes from './usage.routes';

// Mount routes
// router.use('/auth', authRoutes);
// router.use('/repositories', repositoryRoutes);
// router.use('/metrics', metricsRoutes);
// router.use('/usage', usageRoutes);

// Mount route modules
router.use('/auth', authRoutes);
router.use('/repositories', repositoryRoutes);

// Root endpoint
router.get('/', (_req, res) => {
  res.json({
    message: 'Developer Metrics API',
    version: process.env.API_VERSION,
    status: 'operational',
    endpoints: {
      health: '/health',
      auth: {
        register: 'POST /api/v1/auth/register',
        me: 'GET /api/v1/auth/me',
        listKeys: 'GET /api/v1/auth/keys',
        getKey: 'GET /api/v1/auth/keys/:id',
        revokeKey: 'POST /api/v1/auth/keys/:id/revoke',
        deleteKey: 'DELETE /api/v1/auth/keys/:id',
      },
      repositories: {
        register: 'POST /api/v1/repositories',
        list: 'GET /api/v1/repositories',
        get: 'GET /api/v1/repositories/:id',
        delete: 'DELETE /api/v1/repositories/:id',
      },
      metrics: {
        summary: 'GET /api/v1/repositories/:id/metrics/summary',
        commits: 'GET /api/v1/repositories/:id/metrics/commits',
        contributors: 'GET /api/v1/repositories/:id/metrics/contributors',
        activity: 'GET /api/v1/repositories/:id/metrics/activity',
      },
    },
  });
});

// Temporary test route
router.get('/', (_req, res) => {
  res.json({
    message: 'Developer Metrics API',
    version: process.env.API_VERSION,
    status: 'operational',
    endpoints: {
      health: '/health',
      auth: '/api/v1/auth',
      repositories: '/api/v1/repositories',
      metrics: '/api/v1/metrics',
      usage: '/api/v1/usage',
    },
  });
});

export default router;
