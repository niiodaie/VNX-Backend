import express, { Express, Request, Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import dotenv from 'dotenv'
import { rateLimiter } from './middleware/rateLimiter'
import healthRoutes from './routes/health'
import emailRoutes from './routes/email'
import leadRoutes from './routes/leads'

// Load environment variables
dotenv.config()

const app: Express = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}))
app.use(compression())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Rate limiting
app.use(rateLimiter)

// Routes
app.use('/api/health', healthRoutes)
app.use('/api/email', emailRoutes)
app.use('/api/leads', leadRoutes)

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Visnec Virtual Assistant API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      email: '/api/email',
      leads: '/api/leads',
    },
  })
})

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  })
})

// Error handler
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error('Error:', err)
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  })
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Visnec VVA Backend running on port ${PORT}`)
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`)
})

export default app

