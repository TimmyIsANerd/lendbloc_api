import { swaggerUI } from '@hono/swagger-ui'
import type { Hono } from 'hono'

export function setupDocs(app: Hono) {
  // Build a basic OpenAPI document as per Hono Swagger UI example
  // You can expand schemas/responses as needed. Grouped via tags.
  const openApiDoc = {
    openapi: '3.0.0',
    info: {
      title: 'LendBloc API',
      version: '1.0.0',
      description:
        'LendBloc is a crypto lending and savings platform. This documentation covers public, user, and admin APIs. Grouped by feature areas for clarity.',
    },
    tags: [
      { name: 'Auth', description: 'User authentication & verification' },
      { name: 'Lending', description: 'Loan creation & repayment' },
      { name: 'Savings', description: 'Savings accounts & withdrawals' },
      { name: 'Exchange', description: 'Crypto swaps & coin voting' },
      { name: 'Admin Assets', description: 'Asset management for admins' },
    ],
    components: {
      securitySchemes: {
        BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    paths: {
      '/api/v1/auth/register': {
        post: {
          tags: ['Auth'],
          summary: 'Register a new user',
          description:
            'Creates a user account. In DEVELOPMENT (via CURRENT_ENVIRONMENT), email/phone/KYC are auto-verified and OTP email is skipped.',
          responses: {
            '200': { description: 'User registered successfully' },
            '409': { description: 'User already exists' },
          },
        },
      },
      '/api/v1/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Initiate login',
          description: 'Starts login flow. In DEVELOPMENT, OTP is skipped; otherwise an OTP is sent to email/phone.',
          responses: {
            '200': { description: 'OTP sent or bypassed (DEV mode)' },
            '401': { description: 'Invalid credentials or user unverified' },
          },
        },
      },
      '/api/v1/auth/verify-login': {
        post: {
          tags: ['Auth'],
          summary: 'Verify login with OTP (or bypass in dev)',
          description: 'Verifies the login OTP and returns access/refresh tokens. In DEVELOPMENT, OTP check is bypassed.',
          responses: {
            '200': { description: 'Access token (and refresh token via cookie for web clients)' },
            '400': { description: 'Invalid or expired OTP (non-dev)' },
          },
        },
      },
      '/api/v1/lending/loans': {
        post: {
          tags: ['Lending'],
          summary: 'Create a loan',
          description:
            'Creates a loan requiring a termDays and applies asset-based interest by user accountType (REG/PRO) and term.',
          security: [{ BearerAuth: [] }],
          responses: {
            '200': { description: 'Loan created' },
            '400': { description: 'Invalid asset or insufficient collateral' },
          },
        },
      },
      '/api/v1/savings': {
        post: {
          tags: ['Savings'],
          summary: 'Create savings account',
          description:
            'Creates a savings account with termDays; APY is pulled from asset.savingsInterest[term]; funds are locked until lockEndAt.',
          security: [{ BearerAuth: [] }],
          responses: {
            '200': { description: 'Savings account created' },
            '400': { description: 'Asset not found/available or insufficient wallet balance' },
          },
        },
      },
      '/api/v1/exchange/swap': {
        post: {
          tags: ['Exchange'],
          summary: 'Swap crypto',
          description:
            'Swaps from one asset to another. Applies split fees: fromAsset.fees.exchangeFeePercentFrom and toAsset.fees.exchangeFeePercentTo. Deducts amount+fromFee, credits net (converted - toFee).',
          security: [{ BearerAuth: [] }],
          responses: {
            '200': { description: 'Swap successful' },
            '400': { description: 'Asset invalid/unavailable or insufficient balance' },
          },
        },
      },
      '/api/v1/admin/assets': {
        post: {
          tags: ['Admin Assets'],
          summary: 'Create asset',
          description:
            'Create a new asset. For tokens, provide tokenAddress and decimals. Supports split exchange fees (from/to).',
          security: [{ BearerAuth: [] }],
          responses: {
            '201': { description: 'Asset created' },
            '409': { description: 'Duplicate asset for network' },
          },
        },
        get: {
          tags: ['Admin Assets'],
          summary: 'List assets',
          description: 'List assets with filters and pagination.',
          security: [{ BearerAuth: [] }],
          responses: {
            '200': { description: 'List of assets' },
          },
        },
      },
      '/api/v1/admin/assets/{id}': {
        get: {
          tags: ['Admin Assets'],
          summary: 'Get asset by ID',
          description: 'Fetch a single asset.',
          security: [{ BearerAuth: [] }],
          responses: {
            '200': { description: 'Asset' },
            '404': { description: 'Asset not found' },
          },
        },
        put: {
          tags: ['Admin Assets'],
          summary: 'Update asset',
          description: 'Update asset fields, including fees and status.',
          security: [{ BearerAuth: [] }],
          responses: {
            '200': { description: 'Asset updated' },
            '404': { description: 'Asset not found' },
            '409': { description: 'Duplicate' },
          },
        },
      },
      '/api/v1/admin/assets/{id}/list': {
        post: {
          tags: ['Admin Assets'],
          summary: 'List an asset',
          description: 'Set status to LISTED.',
          security: [{ BearerAuth: [] }],
          responses: {
            '200': { description: 'Asset listed' },
            '404': { description: 'Asset not found' },
          },
        },
      },
      '/api/v1/admin/assets/{id}/delist': {
        post: {
          tags: ['Admin Assets'],
          summary: 'Delist an asset',
          description: 'Set status to DELISTED.',
          security: [{ BearerAuth: [] }],
          responses: {
            '200': { description: 'Asset delisted' },
            '404': { description: 'Asset not found' },
          },
        },
      },
    },
  }

  // Serve the OpenAPI JSON
  app.get('/api/v1/docs', (c) => c.json(openApiDoc))
  // Serve Swagger UI referencing the JSON endpoint
  app.get('/api/v1/docs/ui', swaggerUI({ url: '/api/v1/docs' }))
}

