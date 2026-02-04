import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';
import * as metricsController from '../controllers/metrics.controller';

const router = Router({ mergeParams: true }); // mergeParams to access :id from parent route

/**
 * All metrics routes require authentication + rate limiting
 */

// Trigger repository analysis
router.post('/analyze', authenticate, rateLimiter, metricsController.analyze);

// Get repository summary
router.get('/summary', authenticate, rateLimiter, metricsController.getSummary);

// Get commit frequency metrics
router.get('/commits', authenticate, rateLimiter, metricsController.getCommitMetrics);

// Get contributor metrics
router.get('/contributors', authenticate, rateLimiter, metricsController.getContributorMetricsHandler);

// Get activity metrics
router.get('/activity', authenticate, rateLimiter, metricsController.getActivityMetricsHandler);

export default router;