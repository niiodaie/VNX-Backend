import { Request, Response } from 'express';
import { logger } from '../utils/logger';

// In-memory storage (replace with database)
const memoryStore = new Map<string, any>();

export const saveMemory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, key, value } = req.body;

    if (!userId || !key) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'userId and key are required',
      });
      return;
    }

    const userMemory = memoryStore.get(userId) || {};
    userMemory[key] = {
      value,
      savedAt: new Date().toISOString(),
    };
    memoryStore.set(userId, userMemory);

    logger.info(`Memory saved for user: ${userId}, key: ${key}`);

    res.status(201).json({
      success: true,
      message: 'Memory saved successfully',
    });
  } catch (error) {
    logger.error(`Memory save error: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to save memory',
    });
  }
};

export const getMemory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const memory = memoryStore.get(userId) || {};

    res.json({
      success: true,
      data: memory,
    });
  } catch (error) {
    logger.error(`Memory retrieval error: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve memory',
    });
  }
};

export const searchMemory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, query } = req.body;

    const memory = memoryStore.get(userId) || {};
    const results = Object.entries(memory).filter(([key, value]: [string, any]) =>
      key.toLowerCase().includes(query.toLowerCase()) ||
      JSON.stringify(value).toLowerCase().includes(query.toLowerCase())
    );

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    logger.error(`Memory search error: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to search memory',
    });
  }
};

