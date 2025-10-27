import { Router } from 'express';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';

const router = Router();
const feedbackStore: any[] = [];

router.post('/', (req: Request, res: Response) => {
  const { rating, comment, category, sessionId } = req.body;
  const feedback = { id: Date.now(), rating, comment, category, sessionId, createdAt: new Date().toISOString() };
  feedbackStore.push(feedback);
  logger.info(`Feedback submitted: ${feedback.id}`);
  res.status(201).json({ success: true, data: feedback });
});

router.get('/', (req: Request, res: Response) => {
  res.json({ success: true, data: feedbackStore });
});

export default router;
