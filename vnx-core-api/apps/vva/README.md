# Visnec Virtual Assistant - Backend API

RESTful API backend for the Visnec Virtual Assistant platform.

## Features

- **Express.js** server with TypeScript
- **Supabase** integration for database operations
- **Email sending** via Nodemailer (Office 365 SMTP)
- **Rate limiting** to prevent abuse
- **CORS** enabled for frontend integration
- **Security** headers with Helmet
- **Compression** for optimized responses

## API Endpoints

### Health Check
- `GET /api/health` - Check API health and configuration status

### Email
- `POST /api/email/send` - Send an email
- `POST /api/email/generate` - Generate AI-powered email content

### Leads
- `GET /api/leads` - Get all leads
- `POST /api/leads` - Create a new lead
- `PUT /api/leads/:id` - Update a lead
- `DELETE /api/leads/:id` - Delete a lead

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```env
PORT=5000
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-key
SMTP_HOST=smtp.office365.com
SMTP_USER=your-email@visnec-technologies.com
SMTP_PASS=your-password
```

## Development

```bash
npm run dev
```

## Production

```bash
npm run build
npm start
```

## Deployment

### Option 1: DigitalOcean App Platform

1. Push code to GitHub
2. Create new App on DigitalOcean
3. Connect GitHub repository
4. Configure environment variables
5. Deploy!

### Option 2: Render

1. Push code to GitHub
2. Create new Web Service on Render
3. Connect repository
4. Set build command: `npm install && npm run build`
5. Set start command: `npm start`
6. Add environment variables
7. Deploy!

## License

MIT

