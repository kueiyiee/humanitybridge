import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { checkDatabaseConnection, getDbDiagnostics } from '../db/index';
import { env } from './config/env';
import { openApiSpec } from './config/openapi';
import { attachSessionUser, verifyCsrfForMutations } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import publicRoutes from './routes/public';
import donationRoutes from './routes/donations';
import coordinatorRoutes from './routes/coordinator';
import adminRoutes from './routes/admin';
import mediaRoutes from './routes/media';

export function createApiApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: env.isProduction
        ? undefined
        : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(cookieParser());
  app.use(express.json({
    limit: '2mb',
    verify: (req, _res, buffer) => {
      (req as typeof req & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
    },
  }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api', globalLimiter);

  app.use(attachSessionUser);
  app.use(verifyCsrfForMutations);

  app.get('/api/health/live', (_req, res) => {
    res.status(200).json({ success: true, data: { status: 'alive' } });
  });

  app.get('/api/health/ready', async (_req, res) => {
    try {
      await checkDatabaseConnection();
      return res.status(200).json({
        success: true,
        data: { status: 'ready', database: getDbDiagnostics(), timestamp: new Date().toISOString() },
      });
    } catch {
      return res.status(503).json({
        success: false,
        data: { status: 'not_ready', database: { status: 'disconnected' }, timestamp: new Date().toISOString() },
      });
    }
  });

  app.get('/api/health', async (_req, res) => {
    try {
      await checkDatabaseConnection();
      return res.status(200).json({
        success: true,
        message: 'HumanityBridge API healthy',
        data: { status: 'ok', timestamp: new Date().toISOString(), database: getDbDiagnostics() },
      });
    } catch {
      return res.status(503).json({
        success: false,
        message: 'HumanityBridge API is not ready',
        data: { status: 'unavailable', timestamp: new Date().toISOString() },
      });
    }
  });

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1', publicRoutes);
  app.use('/api/v1', donationRoutes);
  app.use('/api/v1/coordinator', coordinatorRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/media', mediaRoutes);

  app.use('/api', (_req, res) => {
    res.status(404).json({ success: false, message: 'API endpoint not found', data: null });
  });

  app.use(errorHandler);
  return app;
}
