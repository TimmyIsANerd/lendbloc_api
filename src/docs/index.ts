import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'
import type { Hono } from 'hono'

// Import request schemas from existing modules
import { registerUserSchema, loginUserSchema, verifyOtpSchema } from '../modules/auth/auth.validation'
import { createLoanSchema } from '../modules/lending/lending.validation'
import { createSavingsAccountSchema } from '../modules/savings/savings.validation'
import { swapCryptoSchema } from '../modules/exchange/exchange.validation'
import { createAssetSchema, updateAssetSchema, listAssetsQuerySchema } from '../modules/adminAssets/assets.validation'

export function setupDocs(app: Hono) {
  const doc = new OpenAPIHono()

  // Basic API info and Security
  doc.doc('/ignore-docs', {
    openapi: '3.0.0',
    info: {
      title: 'LendBloc API',
      version: '1.0.0',
      description:
        'LendBloc is a crypto lending and savings platform. This documentation covers public, user, and admin APIs. Grouped by feature areas for clarity.',
    },
    tags: [
      { name: 'Auth', description: 'User authentication & verification' },
      { name: 'Users', description: 'User profile & settings' },
      { name: 'Wallets', description: 'Wallet management' },
      { name: 'Lending', description: 'Loan creation & repayment' },
      { name: 'Savings', description: 'Savings accounts & withdrawals' },
      { name: 'Exchange', description: 'Crypto swaps & coin voting' },
      { name: 'Admin', description: 'Admin operations' },
      { name: 'Admin Assets', description: 'Asset management for admins' },
      { name: 'Webhooks', description: 'Inbound webhooks (Tatum, Shufti)' },
      { name: 'Referrals', description: 'Referral program' },
      { name: 'Prices', description: 'Price endpoints' },
      { name: 'Dashboard', description: 'Aggregated user data' },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  })

  // ---------- Auth ----------
  doc.openapi(
    createRoute({
      method: 'post',
      path: '/api/v1/auth/register',
      tags: ['Auth'],
      summary: 'Register a new user',
      description:
        'Creates a user account. In DEVELOPMENT (via CURRENT_ENVIRONMENT), email/phone/KYC are auto-verified and OTP email is skipped.',
      request: {
        body: {
          content: {
            'application/json': {
              schema: registerUserSchema,
            },
          },
        },
      },
      responses: {
        200: {
          description: 'User registered successfully',
          content: {
            'application/json': {
              schema: z.object({ message: z.string(), userId: z.string() }),
            },
          },
        },
        409: { description: 'User already exists' },
      },
    }),
    () => {}
  )

  doc.openapi(
    createRoute({
      method: 'post',
      path: '/api/v1/auth/login',
      tags: ['Auth'],
      summary: 'Initiate login',
      description:
        'Starts login flow. In DEVELOPMENT, OTP is skipped; otherwise an OTP is sent to email/phone.',
      request: {
        body: {
          content: { 'application/json': { schema: loginUserSchema } },
        },
      },
      responses: {
        200: {
          description: 'OTP sent or bypassed (DEV mode)',
          content: {
            'application/json': {
              schema: z.object({ message: z.string(), userId: z.string().optional() }),
            },
          },
        },
        401: { description: 'Invalid credentials or user unverified' },
      },
    }),
    () => {}
  )

  doc.openapi(
    createRoute({
      method: 'post',
      path: '/api/v1/auth/verify-login',
      tags: ['Auth'],
      summary: 'Verify login with OTP (or bypass in dev)',
      description: 'Verifies the login OTP and returns access/refresh tokens. In DEVELOPMENT, OTP check is bypassed.',
      request: { body: { content: { 'application/json': { schema: verifyOtpSchema } } } },
      responses: {
        200: {
          description: 'Access token (and refresh token via cookie for web clients)',
          content: { 'application/json': { schema: z.object({ accessToken: z.string().optional(), refreshToken: z.string().optional() }) } },
        },
        400: { description: 'Invalid or expired OTP (non-dev)' },
      },
    }),
    () => {}
  )

  // ---------- Lending ----------
  doc.openapi(
    createRoute({
      method: 'post',
      path: '/api/v1/lending/loans',
      tags: ['Lending'],
      security: [{ BearerAuth: [] }],
      summary: 'Create a loan',
      description:
        'Creates a loan requiring a termDays and applies asset-based interest by user accountType (REG/PRO) and term.',
      request: { body: { content: { 'application/json': { schema: createLoanSchema } } } },
      responses: {
        200: { description: 'Loan created' },
        400: { description: 'Invalid asset or insufficient collateral' },
      },
    }),
    () => {}
  )

  // ---------- Savings ----------
  doc.openapi(
    createRoute({
      method: 'post',
      path: '/api/v1/savings',
      tags: ['Savings'],
      security: [{ BearerAuth: [] }],
      summary: 'Create savings account',
      description:
        'Creates a savings account with termDays; APY is pulled from asset.savingsInterest[term]; funds are locked until lockEndAt.',
      request: { body: { content: { 'application/json': { schema: createSavingsAccountSchema } } } },
      responses: {
        200: { description: 'Savings account created' },
        400: { description: 'Asset not found/available or insufficient wallet balance' },
      },
    }),
    () => {}
  )

  // ---------- Exchange ----------
  doc.openapi(
    createRoute({
      method: 'post',
      path: '/api/v1/exchange/swap',
      tags: ['Exchange'],
      security: [{ BearerAuth: [] }],
      summary: 'Swap crypto',
      description:
        'Swaps from one asset to another. Applies split fees: fromAsset.fees.exchangeFeePercentFrom and toAsset.fees.exchangeFeePercentTo. Deducts amount+fromFee, credits net (converted - toFee).',
      request: { body: { content: { 'application/json': { schema: swapCryptoSchema } } } },
      responses: {
        200: {
          description: 'Swap successful',
          content: {
            'application/json': {
              schema: z.object({
                message: z.string(),
                amount: z.number(),
                convertedAmount: z.number(),
                fromFeePercent: z.number().optional(),
                toFeePercent: z.number().optional(),
                fromFeeAmount: z.number().optional(),
                toFeeAmount: z.number().optional(),
                netReceived: z.number(),
              }),
            },
          },
        },
        400: { description: 'Asset invalid/unavailable or insufficient balance' },
      },
    }),
    () => {}
  )

  // ---------- Admin Assets ----------
  doc.openapi(
    createRoute({
      method: 'post',
      path: '/api/v1/admin/assets',
      tags: ['Admin Assets'],
      security: [{ BearerAuth: [] }],
      summary: 'Create asset',
      description:
        'Create a new asset. For tokens, provide tokenAddress and decimals. Supports split exchange fees (from/to).',
      request: { body: { content: { 'application/json': { schema: createAssetSchema } } } },
      responses: {
        201: { description: 'Asset created' },
        409: { description: 'Duplicate asset for network' },
      },
    }),
    () => {}
  )

  doc.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/admin/assets',
      tags: ['Admin Assets'],
      security: [{ BearerAuth: [] }],
      summary: 'List assets',
      description: 'List assets with filters and pagination.',
      request: { query: listAssetsQuerySchema },
      responses: { 200: { description: 'List of assets' } },
    }),
    () => {}
  )

  doc.openapi(
    createRoute({
      method: 'get',
      path: '/api/v1/admin/assets/{id}',
      tags: ['Admin Assets'],
      security: [{ BearerAuth: [] }],
      summary: 'Get asset by ID',
      description: 'Fetch a single asset.',
      request: { params: z.object({ id: z.string().openapi({ example: '65a6f7e7f7f7f7f7f7f7f7f7' }) }) },
      responses: { 200: { description: 'Asset' }, 404: { description: 'Asset not found' } },
    }),
    () => {}
  )

  doc.openapi(
    createRoute({
      method: 'put',
      path: '/api/v1/admin/assets/{id}',
      tags: ['Admin Assets'],
      security: [{ BearerAuth: [] }],
      summary: 'Update asset',
      description: 'Update asset fields, including fees and status.',
      request: {
        params: z.object({ id: z.string() }),
        body: { content: { 'application/json': { schema: updateAssetSchema } } },
      },
      responses: { 200: { description: 'Asset updated' }, 404: { description: 'Asset not found' }, 409: { description: 'Duplicate' } },
    }),
    () => {}
  )

  doc.openapi(
    createRoute({
      method: 'post',
      path: '/api/v1/admin/assets/{id}/list',
      tags: ['Admin Assets'],
      security: [{ BearerAuth: [] }],
      summary: 'List an asset',
      description: 'Set status to LISTED.',
      request: { params: z.object({ id: z.string() }) },
      responses: { 200: { description: 'Asset listed' }, 404: { description: 'Asset not found' } },
    }),
    () => {}
  )

  doc.openapi(
    createRoute({
      method: 'post',
      path: '/api/v1/admin/assets/{id}/delist',
      tags: ['Admin Assets'],
      security: [{ BearerAuth: [] }],
      summary: 'Delist an asset',
      description: 'Set status to DELISTED.',
      request: { params: z.object({ id: z.string() }) },
      responses: { 200: { description: 'Asset delisted' }, 404: { description: 'Asset not found' } },
    }),
    () => {}
  )

  // Build schema and mount routes on main app
  const schema = doc.getOpenAPISchema()
  app.get('/api/v1/docs', (c) => c.json(schema))
  app.get('/api/v1/docs/ui', swaggerUI({ url: '/api/v1/docs' }))
}

