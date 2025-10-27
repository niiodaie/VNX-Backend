import { Request, Response } from 'express'
import { sendEmailService, generateEmailService } from '../services/emailService'

export const sendEmail = async (req: Request, res: Response) => {
  try {
    const { to, subject, body } = req.body

    if (!to || !subject || !body) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['to', 'subject', 'body'],
      })
    }

    const result = await sendEmailService(to, subject, body)

    if (!result.success) {
      return res.status(500).json({
        error: 'Failed to send email',
        message: result.message,
      })
    }

    res.json({
      success: true,
      message: 'Email sent successfully',
    })
  } catch (error: any) {
    console.error('Error in sendEmail controller:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    })
  }
}

export const generateEmail = async (req: Request, res: Response) => {
  try {
    const { clientName, company, industry } = req.body

    if (!clientName || !company) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['clientName', 'company'],
      })
    }

    const result = await generateEmailService(clientName, company, industry)

    res.json({
      success: true,
      subject: result.subject,
      body: result.body,
    })
  } catch (error: any) {
    console.error('Error in generateEmail controller:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    })
  }
}

