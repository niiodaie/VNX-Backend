import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { generateAIResponse } from '../services/aiService';

/**
 * Send a message to the VVA AI assistant
 */
export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, userId, sessionId } = req.body;

    // Validate input
    if (!message || typeof message !== 'string') {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Message is required and must be a string',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    logger.info(`Chat message received: "${message.substring(0, 50)}..."`);

    // Generate AI response (currently mock)
    const aiResponse = await generateAIResponse(message, userId, sessionId);

    res.json({
      success: true,
      data: {
        message: aiResponse,
        timestamp: new Date().toISOString(),
        sessionId: sessionId || 'default-session',
      },
    });
  } catch (error) {
    logger.error(`Chat error: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process chat message',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Get chat history (placeholder for future implementation)
 */
export const getChatHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, sessionId } = req.query;

    logger.info(`Chat history requested for user: ${userId}, session: ${sessionId}`);

    // TODO: Implement actual chat history retrieval from database
    res.json({
      success: true,
      data: {
        history: [],
        message: 'Chat history feature coming soon',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error(`Chat history error: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve chat history',
      timestamp: new Date().toISOString(),
    });
  }
};

