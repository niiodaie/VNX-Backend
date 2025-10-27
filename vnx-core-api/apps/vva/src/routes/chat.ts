import { Router } from 'express';
import { sendMessage, getChatHistory } from '../controllers/chatController';

const router = Router();

/**
 * @route   POST /api/chat
 * @desc    Send a message to the VVA AI assistant
 * @access  Public (will be protected in production)
 */
router.post('/', sendMessage);

/**
 * @route   GET /api/chat/history
 * @desc    Get chat history (placeholder for future implementation)
 * @access  Public (will be protected in production)
 */
router.get('/history', getChatHistory);

export default router;

