import { Router } from 'express';
import { createSession, getSession, endSession } from '../controllers/sessionController';
import { validateBody } from '../middlewares/validator';
import { schemas } from '../middlewares/validator';

const router = Router();

/**
 * @swagger
 * /api/session:
 *   post:
 *     summary: Create a new user session
 *     tags: [Session]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Session created successfully
 *       500:
 *         description: Server error
 */
router.post('/', validateBody(schemas.sessionCreate), createSession);

/**
 * @swagger
 * /api/session/{sessionId}:
 *   get:
 *     summary: Get session details
 *     tags: [Session]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session details
 *       404:
 *         description: Session not found
 */
router.get('/:sessionId', getSession);

/**
 * @swagger
 * /api/session/{sessionId}/end:
 *   post:
 *     summary: End a session
 *     tags: [Session]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session ended successfully
 *       404:
 *         description: Session not found
 */
router.post('/:sessionId/end', endSession);

export default router;

