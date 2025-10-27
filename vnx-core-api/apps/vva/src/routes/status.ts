import { Router } from 'express';
import { getStatus, getHealth } from '../controllers/statusController';

const router = Router();

/**
 * @route   GET /api/status
 * @desc    Get API status and version information
 * @access  Public
 */
router.get('/', getStatus);

/**
 * @route   GET /api/status/health
 * @desc    Health check endpoint for monitoring
 * @access  Public
 */
router.get('/health', getHealth);

export default router;

