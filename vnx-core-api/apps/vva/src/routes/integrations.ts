import { Router } from 'express';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  res.json({ success: true, data: [{ name: 'FaceUp', status: 'available' }, { name: 'Netscan', status: 'available' }] });
});

router.post('/connect', (req: Request, res: Response) => {
  const { integration } = req.body;
  logger.info(`Integration connection requested: ${integration}`);
  res.json({ success: true, message: `Connected to ${integration}` });
});

export default router;
