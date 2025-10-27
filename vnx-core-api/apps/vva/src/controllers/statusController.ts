import { Request, Response } from 'express';
import { logger } from '../utils/logger';

/**
 * Get API status and version information
 */
export const getStatus = (req: Request, res: Response): void => {
  try {
    const status = {
      status: 'online',
      version: '1.0.0',
      service: 'Visnec Virtual Assistant API',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB',
      },
    };

    logger.info('Status check requested');
    res.json(status);
  } catch (error) {
    logger.error(`Status check failed: ${error}`);
    res.status(500).json({
      error: 'Failed to retrieve status',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Health check endpoint for monitoring services
 */
export const getHealth = (req: Request, res: Response): void => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        api: 'operational',
        database: 'not_configured', // TODO: Add database health check
        ai_service: 'not_configured', // TODO: Add AI service health check
      },
    };

    res.json(health);
  } catch (error) {
    logger.error(`Health check failed: ${error}`);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
    });
  }
};

