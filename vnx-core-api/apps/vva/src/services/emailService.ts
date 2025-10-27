import nodemailer from 'nodemailer'

export const sendEmailService = async (
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; message: string }> => {
  try {
    // Check if SMTP is configured
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      console.log('SMTP not configured - email would be sent to:', to)
      return {
        success: true,
        message: 'Email logged (SMTP not configured)',
      }
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    }

    await transporter.sendMail(mailOptions)

    return {
      success: true,
      message: 'Email sent successfully',
    }
  } catch (error: any) {
    console.error('Error sending email:', error)
    return {
      success: false,
      message: error.message,
    }
  }
}

export const generateEmailService = async (
  clientName: string,
  company: string,
  industry?: string
): Promise<{ subject: string; body: string }> => {
  // Placeholder AI email generation
  // TODO: Integrate with OpenAI GPT-5 API

  const subject = `Partnership Opportunity with ${company}`
  
  const body = `Hi ${clientName},<br/><br/>

I'm Alex from Visnec Technologies.<br/><br/>

We help companies like ${company}${industry ? ` in the ${industry} industry` : ''} simplify their IT and network systems with smarter, scalable solutions. Our team specializes in delivering reliable infrastructure that grows with your business.<br/><br/>

Would you be open to a quick chat this week to explore how we can support your technology needs?<br/><br/>

Best regards,<br/>
Alex<br/>
Visnec Technologies<br/>
<a href="mailto:sales@visnec-technologies.com">sales@visnec-technologies.com</a>`

  return { subject, body }
}

