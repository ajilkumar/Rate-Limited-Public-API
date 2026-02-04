import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import logger from './config/logger';
import { connectRedis } from './config/redis';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { env } from './config/env';
import routes from './routes';
import { usageTracker } from './middleware/usageTracker';

const app: Application = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(','),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-KEY'],
    credentials: true,
  })
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Usage tracking middleware
app.use(usageTracker);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
    version: env.API_VERSION,
  });
});

// API routes
app.use(`/api/${env.API_VERSION}`, routes);

// 404 error handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Initialize connections
export const intializeApp = async (): Promise<void> => {
  try {
    // connect to Redis
    await connectRedis();

    logger.info('Application initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize application', {
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }
};

export default app;
