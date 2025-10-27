import { Router } from 'express'
import { sendEmail, generateEmail } from '../controllers/emailController'
import { emailRateLimiter } from '../middleware/rateLimiter'

const router = Router()

// Apply rate limiting to email routes
router.use(emailRateLimiter)

// POST /api/email/send - Send an email
router.post('/send', sendEmail)

// POST /api/email/generate - Generate AI email
router.post('/generate', generateEmail)

export default router

