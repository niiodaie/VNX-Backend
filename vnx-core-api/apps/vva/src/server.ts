import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';

// Import routes
import chatRoutes from './routes/chat';
import statusRoutes from './routes/status';
import sessionRoutes from './routes/session';
import insightRoutes from './routes/insight';
import memoryRoutes from './routes/memory';
import knowledgeRoutes from './routes/knowledge';
import voiceRoutes from './routes/voice';
import analyticsRoutes from './routes/analytics';
import integrationsRoutes from './routes/integrations';
import feedbackRoutes from './routes/feedback';

// Import utilities
import { logger, morganStream } from './utils/logger';
import { apiLimiter } from './middlewares/rateLimiter';
import { swaggerSpec } from './config/swagger';
import { initSupabase } from './config/supabase';

// Load environment variables
dotenv.config();

// Initialize Supabase
initSupabase();

// Initialize Express app
const app: Application = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet()); // Security headers
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
}));
app.use(compression()); // Compress responses
app.use(morgan('combined', { stream: morganStream })); // HTTP request logging
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

// Swagger API Documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'VVA API Documentation',
}));

// Health check endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Visnec Virtual Assistant API',
    version: '1.0.0',
    status: 'online',
    timestamp: new Date().toISOString(),
    documentation: '/api/docs',
  });
});

// API Routes - Tier 1 (Core/MVP)
app.use('/api/status', statusRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/insight', insightRoutes);

// API Routes - Tier 2 (Smart/Post-MVP)
app.use('/api/memory', memoryRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/voice', voiceRoutes);

// API Routes - Tier 3 (Enterprise/Ecosystem)
app.use('/api/analytics', analyticsRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/feedback', feedbackRoutes);

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString(),
  });
});

// Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error(`Error: ${err.message}`, { stack: err.stack });
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message,
    timestamp: new Date().toISOString(),
  });
});

// Start server
app.listen(PORT, () => {
  logger.info('='.repeat(60));
  logger.info('🚀 Visnec Virtual Assistant (vVirtual) Backend API');
  logger.info('='.repeat(60));
  logger.info(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔗 Server URL: http://localhost:${PORT}`);
  logger.info(`📚 API Docs: http://localhost:${PORT}/api/docs`);
  logger.info(`🔒 Rate Limiting: Enabled`);
  logger.info(`🗄️  Supabase: ${process.env.SUPABASE_URL ? 'Connected' : 'Not configured'}`);
  logger.info('='.repeat(60));
});

export default app;

