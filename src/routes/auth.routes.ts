import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as authController from '../controllers/auth.controller';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * Public routes (no authentication required)
 */

// Register new API key
router.post('/register', authController.register);

/**
 * Protected routes (authentication required)
 */

// Get current user info
router.get('/me', authenticate, rateLimiter, authController.getCurrentUser);

// List all API keys for user
router.get('/keys', authenticate, rateLimiter, authController.listKeys);

// Get specific key details
router.get('/keys/:id', authenticate, rateLimiter, authController.getKey);

// Revoke API key (soft delete)
router.post('/keys/:id/revoke', authenticate, rateLimiter, authController.revoke);

// Delete API key permanently
router.delete('/keys/:id', authenticate, rateLimiter, authController.deleteKey);

export default router;
