import { Router } from 'express';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';

const router = Router();

router.post('/query', (req: Request, res: Response) => {
  const { query } = req.body;
  logger.info(`Knowledge query: ${query}`);
  res.json({ success: true, data: { answer: 'Mock knowledge response', sources: [] } });
});

export default router;
