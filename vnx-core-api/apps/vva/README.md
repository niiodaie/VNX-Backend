_# Visnec Virtual Assistant (vVirtual) - Backend API_

_This repository contains the backend API for the Visnec Virtual Assistant (vVirtual). The backend is built with Node.js, Express, and TypeScript, providing a secure, scalable, and production-ready foundation for the vVirtual frontend application. It includes comprehensive features like Supabase integration, Swagger API documentation, Winston logging, and a full suite of API endpoints._

_## ✨ Features_

_- **Robust API**: Built with Express.js and TypeScript for a strongly-typed and maintainable codebase._
_- **Scalable Architecture**: Organized into controllers, services, middlewares, and configs for clear separation of concerns._
_- **Production-Ready**: Includes security headers (Helmet), CORS, compression, rate limiting, and request logging (Winston)._
_- **Comprehensive API Suite**: Tier 1-3 endpoints for core functionality, smart features, and enterprise integrations._
_- **Database & Auth Ready**: Pre-configured for Supabase integration for database, authentication, and storage._
_- **API Documentation**: Auto-generated interactive API documentation with Swagger at `/api/docs`._
_- **Advanced Logging**: Production-grade logging with Winston, including daily log rotation._

_## 🧱 Technology Stack_

_- **Framework**: [Express.js](https://expressjs.com/)_
_- **Language**: [TypeScript](https://www.typescriptlang.org/)_
_- **Runtime**: [Node.js](https://nodejs.org/en/)_
_- **Database/Auth**: [Supabase](https://supabase.com/)_
_- **API Documentation**: [Swagger](https://swagger.io/)_
_- **Logging**: [Winston](https://github.com/winstonjs/winston)_
_- **Security**: [Helmet](https://helmetjs.github.io/), [express-rate-limit](https://github.com/nfriedly/express-rate-limit)_

_## 🚀 Getting Started_

_### Prerequisites_

_- [Node.js](https://nodejs.org/en/) (v18.0.0 or later)_
_- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)_

_### Installation_

_1.  **Clone the repository:**_

    _```bash_
    _git clone <repository-url>_
    _cd VNX-VVA-Backend_
    _```_

_2.  **Install dependencies:**_

    _```bash_
    _npm install_
    _```_

_3.  **Set up environment variables:**_

    _Copy the `.env.example` file to a new file named `.env` and fill in the required values for `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, etc._

_### Running in Development_

_To start the development server with hot-reloading, run:_

_```bash_
_npm run dev_
_```_

_The API will be available at `http://localhost:3001` and the Swagger documentation at `http://localhost:3001/api/docs`._

_### Building for Production_

_To compile the TypeScript code to JavaScript, run:_

_```bash_
_npm run build_
_```_

_This will create a `dist` directory. To run the production build, use:_

_```bash_
_npm start_
_```_

_## ⚙️ Environment Variables_

_Refer to `.env.example` for the full list of environment variables. Key variables include:_

_```env_
_# Server & Logging_
_PORT=3001_
_NODE_ENV=development_
_LOG_LEVEL=info_

_# CORS_
_ALLOWED_ORIGINS=http://localhost:3000,https://vvirtual.vnx.visnec.ai_

_# Supabase_
_SUPABASE_URL=https://your-project.supabase.co_
_SUPABASE_SERVICE_KEY=your-supabase-service-role-key_

_# Security_
_JWT_SECRET=your-jwt-secret-key-minimum-32-characters_
_API_KEY=your-api-key-for-service-to-service-auth_

_# AI Services_
_OPENAI_API_KEY=sk-your-openai-api-key_
_```_

_## 🌐 API Endpoints_

_The API is documented via Swagger and can be explored interactively at the `/api/docs` endpoint. The endpoints are organized into the following tiers:_

_### Tier 1: Core API_

_| Endpoint | Description |_
_|---|---|_| `/api/status` | Health check and system metadata |_
_| `/api/chat` | Handles AI conversations |_
_| `/api/session` | Manages user sessions |_
_| `/api/insight` | Provides conversation summaries and insights |_

_### Tier 2: Smart Features_

_| Endpoint | Description |_
_|---|---|_| `/api/memory` | Saves and recalls user context and preferences |_
_| `/api/knowledge` | Connects to knowledge bases |_
_| `/api/voice` | Voice-to-text and text-to-speech services |_

_### Tier 3: Enterprise & Ecosystem_

_| Endpoint | Description |_
_|---|---|_| `/api/analytics` | Logs usage and performance metrics |_
_| `/api/integrations` | Connects with other VNX tools and third-party apps |_
_| `/api/feedback` | Collects user feedback and ratings |_

_## 🌐 Deployment_

_This backend is designed for deployment on platforms like **DigitalOcean App Platform**, **Render**, or **Railway**._

_### DigitalOcean App Platform_

_1.  **Push your code to a Git repository.**_
_2.  **Create a new App** on the DigitalOcean App Platform._
_3.  **Configure the App:**_
    _- **Build Command**: `npm run build`_
    _- **Run Command**: `npm start`_
    _- **HTTP Port**: `3001`_
_4.  **Add Environment Variables** in the DigitalOcean dashboard._
_5.  **Deploy!**_

_## 📄 License_

_This project is licensed under the MIT License._

