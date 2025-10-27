_# Visnec Virtual Assistant (VVA) - Backend_

_This repository contains the backend API for the Visnec Virtual Assistant (VVA). The backend is built with Node.js, Express, and TypeScript, providing a secure, scalable, and production-ready foundation for the VVA frontend application. It is designed for deployment on platforms like DigitalOcean App Platform, Render, or Railway._

_## ✨ Features_

_- **Robust API**: Built with Express.js and TypeScript for a strongly-typed and maintainable codebase._
_- **Scalable Architecture**: Organized into controllers, services, and routes for clear separation of concerns._
_- **Production-Ready**: Includes security headers (Helmet), CORS configuration, compression, and request logging (Morgan)._
_- **Mock AI Service**: A placeholder AI service that simulates responses, ready for integration with real AI models (e.g., OpenAI, Anthropic)._
_- **Comprehensive Error Handling**: Centralized error handling and logging for easier debugging._
_- **Deployment Ready**: Configured for deployment on modern cloud platforms with a `Procfile`._

_## 🧱 Technology Stack_

_- **Framework**: [Express.js](https://expressjs.com/)_
_- **Language**: [TypeScript](https://www.typescriptlang.org/)_
_- **Runtime**: [Node.js](https://nodejs.org/en/)_
_- **Key Libraries**:_
  _- `cors`: For handling Cross-Origin Resource Sharing_
  _- `helmet`: For securing Express apps with various HTTP headers_
  _- `dotenv`: For managing environment variables_
  _- `morgan`: For HTTP request logging_
  _- `compression`: For response compression_

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

_### Running in Development_

_To start the development server with hot-reloading (using `nodemon` and `ts-node`), run:_

_```bash_
_npm run dev_
_```_

_The API will be available at `http://localhost:3001`._

_### Building for Production_

_To compile the TypeScript code to JavaScript, run:_

_```bash_
_npm run build_
_```_

_This will create a `dist` directory with the compiled JavaScript files. To run the production build, use:_

_```bash_
_npm start_
_```_

_## ⚙️ Environment Variables_

_Create a `.env` file in the root of the project and add the following environment variables. Refer to `.env.example` for a template._

_```env_
_# Server Configuration_
_PORT=3001_
_NODE_ENV=development_

_# CORS Configuration_
_ALLOWED_ORIGINS=http://localhost:3000,https://your-frontend-domain.vercel.app_

_# Security_
_JWT_SECRET=your-jwt-secret-for-user-auth_
_API_KEY=a-secure-api-key-for-service-to-service-communication_

_# AI Service Configuration (for future use)_
_OPENAI_API_KEY=_
_```_

_## 🌐 API Endpoints_

_The following API endpoints are available:_

_| Method | Endpoint             | Description                                   |_
_|--------|----------------------|-----------------------------------------------|_
_| `GET`    | `/`                  | Root health check for the API.                |_
_| `GET`    | `/api/status`        | Get detailed API status and version info.     |_
_| `GET`    | `/api/status/health` | Health check endpoint for monitoring.         |_
_| `POST`   | `/api/chat`          | Send a message to the VVA for a response.     |_
_| `GET`    | `/api/chat/history`  | Get chat history (placeholder).               |_

_### `POST /api/chat` Request Body_

_```json_
_{
  _"message": "Hello, VVA!",_
  _"userId": "user-123",_      _// Optional_
  _"sessionId": "session-abc"_ _// Optional_
_}_
_```_

_### `POST /api/chat` Success Response_

_```json_
_{
  _"success": true,_
  _"data": {_
    _"message": "Hello! I'm Visnec Virtual Assistant. How can I help you today?",_
    _"timestamp": "2025-10-26T10:00:00.000Z",_
    _"sessionId": "session-abc"_
  _}_
_}_
_```_

_## 🌐 Deployment_

_This backend is designed for deployment on platforms like **DigitalOcean App Platform**, **Render**, or **Railway**._

_### DigitalOcean App Platform_

_1.  **Push your code to a Git repository.**_
_2.  **Create a new App** on the DigitalOcean App Platform and connect your repository._
_3.  **Configure the App:**_
    _- **App Type**: `Web Service`_
    _- **Build Command**: `npm run build`_
    _- **Start Command**: `npm start`_
    _- **HTTP Port**: `3001` (or the port you set in your `.env` file)._
_4.  **Add Environment Variables** in the DigitalOcean dashboard._
_5.  **Deploy!**_

_The included `Procfile` can also be used by some platforms to automatically determine the build and start commands._

_## 📄 License_

_This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details._

