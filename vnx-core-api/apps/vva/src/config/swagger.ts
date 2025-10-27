import swaggerJsdoc from 'swagger-jsdoc';
import { version } from '../../package.json';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Visnec Virtual Assistant API',
      version: version,
      description: 'Comprehensive API documentation for the Visnec Virtual Assistant (vVirtual)',
      contact: {
        name: 'Visnec Global',
        url: 'https://visnec.ai',
        email: 'support@visnec.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server',
      },
      {
        url: 'https://vnx-vvirtual-api.ondigitalocean.app',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error type',
            },
            message: {
              type: 'string',
              description: 'Error message',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Error timestamp',
            },
          },
        },
      },
    },
    tags: [
      { name: 'Status', description: 'System status and health checks' },
      { name: 'Chat', description: 'AI conversation endpoints' },
      { name: 'Session', description: 'User session management' },
      { name: 'Insight', description: 'Context and insights' },
      { name: 'Memory', description: 'User context and memory' },
      { name: 'Knowledge', description: 'Knowledge base integration' },
      { name: 'Voice', description: 'Voice interaction' },
      { name: 'Analytics', description: 'Usage analytics' },
      { name: 'Integrations', description: 'Third-party integrations' },
      { name: 'Feedback', description: 'User feedback' },
    ],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);

