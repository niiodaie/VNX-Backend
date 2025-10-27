import { Router } from 'express';
import { getInsight, generateSummary } from '../controllers/insightController';

const router = Router();

/**
 * @swagger
 * /api/insight/{sessionId}:
 *   get:
 *     summary: Get insights for a session
 *     tags: [Insight]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [summary, sentiment, topics]
 *     responses:
 *       200:
 *         description: Insights generated successfully
 *       404:
 *         description: Session not found
 */
router.get('/:sessionId', getInsight);

/**
 * @swagger
 * /api/insight/{sessionId}/summary:
 *   post:
 *     summary: Generate conversation summary
 *     tags: [Insight]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Summary generated successfully
 */
router.post('/:sessionId/summary', generateSummary);

export default router;

