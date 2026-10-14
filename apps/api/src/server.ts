import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import * as crypto from 'crypto';
import * as path from 'path';
import { getEnv, maskSecret } from './config/env';
import { prisma } from './prisma/client';
import { authenticateToken, optionalAuth, requireRole, AuthenticatedRequest } from './security/auth';

// Import controllers
import * as HealthController from './controllers/health.controller';
import * as AuthController from './controllers/auth.controller';
import * as SourcesController from './controllers/sources.controller';
import * as SourceItemsController from './controllers/source-items.controller';
import * as IngestionController from './controllers/ingestion.controller';
import * as EditorialController from './controllers/editorial.controller';
import * as CollaborationController from './controllers/collaboration.controller';
import { securityHeadersMiddleware } from './security/headers';
import { apiRateLimiter, authRateLimiter } from './security/rate-limiter';

const env = getEnv();
const app = express();

// Security: Headers, CORS, and payload size limits
app.use(securityHeadersMiddleware);
app.use(
  cors({
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(apiRateLimiter);

// Request ID & Request logging middleware
app.use((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const requestId = (req.headers['x-request-id'] as string) || `req_${crypto.randomBytes(8).toString('hex')}`;
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path !== '/api/v1/health' && req.path !== '/api/v1/readiness') {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms (${requestId})`);
    }
  });

  next();
});

// Serve frontend web UI
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.static(path.join(process.cwd(), 'public')));

// ─── API V1 ROUTES ─────────────────────────────────────────────────
const router = express.Router();

// Health & Readiness (Public)
router.get('/health', HealthController.getHealth);
router.get('/readiness', HealthController.getReadiness);

// Authentication (Public & Protected with dedicated rate limiter)
router.post('/auth/register', authRateLimiter, AuthController.register);
router.post('/auth/login', authRateLimiter, AuthController.login);
router.get('/auth/me', authenticateToken, AuthController.getMe);

// News Feeds & Source Items (Public Read)
router.get('/news', optionalAuth, SourceItemsController.listSourceItems);
router.get('/source-items', optionalAuth, SourceItemsController.listSourceItems);
router.get('/source-items/:id', optionalAuth, SourceItemsController.getSourceItemById);

// News Sources Management
router.get('/sources', authenticateToken, SourcesController.listSources);
router.post('/sources', authenticateToken, requireRole(['ADMIN']), SourcesController.createSource);

// Ingestion Pipeline
router.post('/ingestion/trigger', authenticateToken, requireRole(['EDITOR', 'ADMIN']), IngestionController.triggerIngestion);
router.get('/ingestion/jobs', authenticateToken, requireRole(['EDITOR', 'ADMIN']), IngestionController.listIngestionJobs);

// Editorial Review Queue
router.get('/editorial/pending', authenticateToken, requireRole(['EDITOR', 'ADMIN']), EditorialController.listPendingReviewItems);
router.post('/editorial/review/:id', authenticateToken, requireRole(['EDITOR', 'ADMIN']), EditorialController.reviewSourceItem);

// Collaboration Radar
router.get('/collaboration/claims', optionalAuth, CollaborationController.listCollaborationClaims);
router.post('/collaboration/claims', authenticateToken, requireRole(['EDITOR', 'ADMIN']), CollaborationController.createCollaborationClaim);

app.use('/api/v1', router);

// Root fallback
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Parmanu Core Intelligence API',
    version: '1.0.0',
    documentation: '/api/v1/health',
  });
});

// Global 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `Cannot ${req.method} ${req.path}`,
    meta: { timestamp: new Date().toISOString(), requestId: (req as any).requestId || 'req-unknown' },
  });
});

// Global Error Handler (Never expose stack traces in production)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(`[UNHANDLED_ERROR] ${err.message}`, err.stack);

  res.status(err.status || 500).json({
    success: false,
    error: env.NODE_ENV === 'production' ? 'Internal server error' : err.message || 'Internal server error',
    meta: { timestamp: new Date().toISOString(), requestId: (req as any).requestId || 'req-unknown' },
  });
});

// Server Initialization
let server: any;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(env.PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Parmanu API Server running on port ${env.PORT}`);
    console.log(`📊 Environment: ${env.NODE_ENV}`);
    console.log(`🔒 Database URL: ${maskSecret(env.DATABASE_URL)}`);
    console.log(`⚡ Health endpoint: http://localhost:${env.PORT}/api/v1/health`);
    console.log(`======================================================\n`);
  });
}

// Graceful Shutdown
async function gracefulShutdown(signal: string) {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  if (server) {
    server.close(async () => {
      console.log('HTTP server closed.');
      await prisma.$disconnect();
      console.log('Database connections closed.');
      process.exit(0);
    });
  } else {
    await prisma.$disconnect();
    process.exit(0);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

export default app;
