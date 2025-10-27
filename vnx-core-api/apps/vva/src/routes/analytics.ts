import { Router } from 'express';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';

const router = Router();

router.get('/usage', (req: Request, res: Response) => {
  res.json({ success: true, data: { totalSessions: 150, totalMessages: 3500, avgSessionDuration: '12 minutes' } });
});

router.get('/performance', (req: Request, res: Response) => {
  res.json({ success: true, data: { avgResponseTime: '250ms', uptime: '99.9%' } });
});

export default router;
