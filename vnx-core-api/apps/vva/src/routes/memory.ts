import { Router } from 'express';
import { saveMemory, getMemory, searchMemory } from '../controllers/memoryController';

const router = Router();

/**
 * @swagger
 * /api/memory:
 *   post:
 *     summary: Save user context to memory
 *     tags: [Memory]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               key:
 *                 type: string
 *               value:
 *                 type: object
 *     responses:
 *       201:
 *         description: Memory saved successfully
 */
router.post('/', saveMemory);

/**
 * @swagger
 * /api/memory/{userId}:
 *   get:
 *     summary: Retrieve user memory
 *     tags: [Memory]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Memory retrieved successfully
 */
router.get('/:userId', getMemory);

/**
 * @swagger
 * /api/memory/search:
 *   post:
 *     summary: Search memory by query
 *     tags: [Memory]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               query:
 *                 type: string
 *     responses:
 *       200:
 *         description: Search results
 */
router.post('/search', searchMemory);

export default router;

