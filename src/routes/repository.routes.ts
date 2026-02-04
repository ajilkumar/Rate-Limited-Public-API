import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';
import * as repositoryController from '../controllers/repository.controller';
import metricsRoutes from './metrics.routes';

const router = Router();

/**
 * All repository routes require authentication + rate limiting
 */

// Register new repository
router.post('/', authenticate, rateLimiter, repositoryController.register);

// List repositories
router.get('/', authenticate, rateLimiter, repositoryController.list);

// Get repository details
router.get('/:id', authenticate, rateLimiter, repositoryController.get);

// Delete repository
router.delete('/:id', authenticate, rateLimiter, repositoryController.remove);
/*
 * Metrics sub-routes
 * Mounted at /api/v1/repositories/:id/metrics/*
 */
router.use('/:id/metrics', metricsRoutes);

export default router;
