import { Router, Request, Response } from 'express'
import { isSupabaseConfigured } from '../config/supabase'

const router = Router()

router.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      supabase: isSupabaseConfigured() ? 'configured' : 'not configured',
      email: process.env.SMTP_HOST ? 'configured' : 'not configured',
    },
  })
})

export default router

