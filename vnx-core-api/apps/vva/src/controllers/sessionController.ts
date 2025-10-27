import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

// In-memory session storage (replace with database in production)
const sessions = new Map<string, any>();

/**
 * Create a new user session
 */
export const createSession = (req: Request, res: Response): void => {
  try {
    const { userId, metadata } = req.body;
    const sessionId = uuidv4();

    const session = {
      sessionId,
      userId: userId || 'anonymous',
      metadata: metadata || {},
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      status: 'active',
      messageCount: 0,
    };

    sessions.set(sessionId, session);
    logger.info(`Session created: ${sessionId}`);

    res.status(201).json({
      success: true,
      data: session,
    });
  } catch (error) {
    logger.error(`Session creation error: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create session',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Get session details
 */
export const getSession = (req: Request, res: Response): void => {
  try {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);

    if (!session) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Session not found',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    logger.info(`Session retrieved: ${sessionId}`);
    res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    logger.error(`Session retrieval error: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve session',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * End a session
 */
export const endSession = (req: Request, res: Response): void => {
  try {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);

    if (!session) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Session not found',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    session.status = 'ended';
    session.endedAt = new Date().toISOString();
    sessions.set(sessionId, session);

    logger.info(`Session ended: ${sessionId}`);
    res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    logger.error(`Session end error: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to end session',
      timestamp: new Date().toISOString(),
    });
  }
};

