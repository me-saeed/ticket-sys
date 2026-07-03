import { STATUSES, PRIORITIES } from '../models/Ticket.js';

// WHY a hand-written spec object instead of generator magic (swagger-jsdoc /
// zod-to-openapi): for 5 endpoints this is shorter, has zero extra
// dependencies at runtime beyond the UI, and reads as documentation. It
// reuses the same STATUSES/PRIORITIES constants as the code, so the enums in
// the docs can't drift from reality. Trade-off: paths added later must be
// documented by hand — acceptable at this API size.

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'Support Ticket API',
    version: '1.0.0',
    description:
      'REST API for the support ticket dashboard. Reads and ticket creation are public; ' +
      'updating tickets requires a Bearer token from POST /api/auth/login ' +
      '(demo agent: agent@example.com / agent123 after seeding).',
  },
  servers: [{ url: '/' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Ticket: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '6a4778e8cc127cea872344d5' },
          title: { type: 'string', example: 'Unable to complete payment' },
          description: { type: 'string' },
          customerName: { type: 'string', example: 'Jane Smith' },
          customerEmail: { type: 'string', format: 'email' },
          status: { type: 'string', enum: [...STATUSES] },
          priority: { type: 'string', enum: [...PRIORITIES] },
          version: { type: 'integer', description: 'Optimistic-locking token; echo as expectedVersion on PATCH' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          details: { type: 'object', additionalProperties: { type: 'string' }, description: 'Per-field validation messages (400 only)' },
        },
      },
    },
  },
  paths: {
    '/api/tickets': {
      get: {
        summary: 'List tickets (filter, search, paginate)',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: [...STATUSES] } },
          { name: 'priority', in: 'query', schema: { type: 'string', enum: [...PRIORITIES] } },
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Case-insensitive search in title and customer name' },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 100 } },
        ],
        responses: {
          '200': {
            description: 'Paged ticket list, newest first',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    tickets: { type: 'array', items: { $ref: '#/components/schemas/Ticket' } },
                    total: { type: 'integer' },
                    page: { type: 'integer' },
                    limit: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create a ticket (public — customers file tickets)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'description', 'customerName', 'customerEmail', 'priority'],
                properties: {
                  title: { type: 'string', maxLength: 200 },
                  description: { type: 'string', maxLength: 5000 },
                  customerName: { type: 'string', maxLength: 100 },
                  customerEmail: { type: 'string', format: 'email' },
                  priority: { type: 'string', enum: [...PRIORITIES] },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Created — status always starts as "open"', content: { 'application/json': { schema: { $ref: '#/components/schemas/Ticket' } } } },
          '400': errorResponse('Validation failed (per-field details)'),
          '429': errorResponse('Write rate limit exceeded'),
        },
      },
    },
    '/api/tickets/{id}': {
      get: {
        summary: 'Get one ticket',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'The ticket', content: { 'application/json': { schema: { $ref: '#/components/schemas/Ticket' } } } },
          '404': errorResponse('Ticket not found'),
        },
      },
      patch: {
        summary: 'Update a ticket (agents only)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: [...STATUSES] },
                  priority: { type: 'string', enum: [...PRIORITIES] },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  expectedVersion: { type: 'integer', description: 'Optimistic locking: version this change is based on' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Updated ticket', content: { 'application/json': { schema: { $ref: '#/components/schemas/Ticket' } } } },
          '400': errorResponse('Validation failed'),
          '401': errorResponse('Missing or invalid token'),
          '404': errorResponse('Ticket not found'),
          '409': errorResponse('Stale expectedVersion — ticket changed by someone else'),
          '429': errorResponse('Write rate limit exceeded'),
        },
      },
    },
    '/api/auth/login': {
      post: {
        summary: 'Agent login — returns a JWT (8h validity)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Token + user profile',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string' },
                    user: { type: 'object', properties: { name: { type: 'string' }, email: { type: 'string' }, role: { type: 'string' } } },
                  },
                },
              },
            },
          },
          '401': errorResponse('Invalid email or password'),
          '429': errorResponse('Login rate limit exceeded (10/min)'),
        },
      },
    },
    '/api/health': {
      get: { summary: 'Liveness probe', responses: { '200': { description: 'OK' } } },
    },
  },
};
