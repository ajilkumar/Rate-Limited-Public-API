import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';
import * as usageController from '../controllers/usage.controller';

const router = Router();

/**
 * All usage routes require authentication + rate limiting
 */

// Get usage statistics
router.get('/stats', authenticate, rateLimiter, usageController.getStats);

// Get quota usage
router.get('/quota', authenticate, rateLimiter, usageController.getQuota);

export default router;