

export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Bitespeed Identity Reconciliation API',
    version: '1.0.0',
    description:
      'Identifies and links customer contacts across multiple purchases by email and/or phone number.',
    contact: {
      name: 'Bitespeed',
      url: 'https://github.com/BiteSpeed',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development server',
    },
  ],
  tags: [
    { name: 'Identity', description: 'Contact identity reconciliation' },
    { name: 'Health', description: 'Service health' },
  ],
  paths: {
    '/identify': {
      post: {
        tags: ['Identity'],
        summary: 'Identify or link a contact',
        description:
          'Given an email and/or phone number, find, link, or create the associated contact cluster. Returns the consolidated contact view with all linked emails, phone numbers, and secondary contact IDs.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/IdentifyRequest' },
              examples: {
                newCustomer: {
                  summary: 'New customer — creates primary contact',
                  value: { email: 'lorraine@hillvalley.edu', phoneNumber: '123456' },
                },
                samePhoneNewEmail: {
                  summary: 'Same phone, new email — links secondary',
                  value: { email: 'mcfly@hillvalley.edu', phoneNumber: '123456' },
                },
                emailOnly: {
                  summary: 'Query by email only',
                  value: { email: 'lorraine@hillvalley.edu', phoneNumber: null },
                },
                phoneOnly: {
                  summary: 'Query by phone only',
                  value: { email: null, phoneNumber: '123456' },
                },
                twoPrimariesMerge: {
                  summary: 'Two primaries — older stays primary',
                  value: { email: 'george@hillvalley.edu', phoneNumber: '717171' },
                },
                numberPhone: {
                  summary: 'phoneNumber as integer (also accepted)',
                  value: { email: 'doc@hillvalley.edu', phoneNumber: 121212 },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Contact cluster resolved successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/IdentifyResponse' },
                example: {
                  contact: {
                    primaryContatctId: 1,
                    emails: ['lorraine@hillvalley.edu', 'mcfly@hillvalley.edu'],
                    phoneNumbers: ['123456'],
                    secondaryContactIds: [2],
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error — both email and phoneNumber are null/missing',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: {
                  error: 'Validation Error',
                  message: 'At least one of email or phoneNumber must be provided',
                },
              },
            },
          },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Returns service status and current timestamp.',
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
                example: { status: 'ok', timestamp: '2026-03-01T00:00:00.000Z' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      IdentifyRequest: {
        type: 'object',
        description: 'At least one of `email` or `phoneNumber` must be non-null.',
        properties: {
          email: {
            type: 'string',
            format: 'email',
            nullable: true,
            example: 'lorraine@hillvalley.edu',
          },
          phoneNumber: {
            oneOf: [
              { type: 'string', example: '123456' },
              { type: 'integer', example: 123456 },
            ],
            nullable: true,
            description: 'Accepts both string and integer values.',
          },
        },
      },
      IdentifyResponse: {
        type: 'object',
        properties: {
          contact: {
            type: 'object',
            properties: {
              primaryContatctId: {
                type: 'integer',
                description: 'ID of the primary contact in the cluster.',
                example: 1,
              },
              emails: {
                type: 'array',
                items: { type: 'string', format: 'email' },
                description: 'All emails in the cluster; primary email first.',
                example: ['lorraine@hillvalley.edu', 'mcfly@hillvalley.edu'],
              },
              phoneNumbers: {
                type: 'array',
                items: { type: 'string' },
                description: 'All phone numbers in the cluster; primary phone first.',
                example: ['123456'],
              },
              secondaryContactIds: {
                type: 'array',
                items: { type: 'integer' },
                description: 'IDs of all secondary contacts linked to the primary.',
                example: [2],
              },
            },
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Validation Error' },
          message: { type: 'string', example: 'At least one of email or phoneNumber must be provided' },
        },
      },
    },
  },
};

export const swaggerUiOptions: any = {
  customSiteTitle: 'Bitespeed Identity API',
  customCss: `
    .swagger-ui .topbar { background-color: #1a1a2e; }
    .swagger-ui .topbar-wrapper img { content: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2300d4aa"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>'); width:30px; }
    .swagger-ui .info .title { color: #00d4aa; }
  `,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2,
    tryItOutEnabled: true,
  },
};
