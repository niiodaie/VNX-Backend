import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '../utils/logger';

/**
 * Validate request body against Joi schema
 */
export const validateBody = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      logger.warn(`Validation error: ${JSON.stringify(errors)}`);

      res.status(400).json({
        error: 'Validation Error',
        message: 'Request validation failed',
        details: errors,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    req.body = value;
    next();
  };
};

/**
 * Validate query parameters against Joi schema
 */
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      logger.warn(`Query validation error: ${JSON.stringify(errors)}`);

      res.status(400).json({
        error: 'Validation Error',
        message: 'Query parameter validation failed',
        details: errors,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    req.query = value;
    next();
  };
};

// Common validation schemas
export const schemas = {
  chatMessage: Joi.object({
    message: Joi.string().required().min(1).max(2000),
    userId: Joi.string().optional(),
    sessionId: Joi.string().optional(),
    context: Joi.object().optional(),
  }),

  sessionCreate: Joi.object({
    userId: Joi.string().optional(),
    metadata: Joi.object().optional(),
  }),

  feedback: Joi.object({
    rating: Joi.number().required().min(1).max(5),
    comment: Joi.string().optional().max(1000),
    category: Joi.string().optional().valid('bug', 'feature', 'general'),
    sessionId: Joi.string().optional(),
  }),

  insight: Joi.object({
    sessionId: Joi.string().required(),
    type: Joi.string().optional().valid('summary', 'sentiment', 'topics'),
  }),
};

