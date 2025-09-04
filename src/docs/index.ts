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
      { name: 'Users', description: 'User profile, email/phone and password change flows' },
      { name: 'Wallets', description: 'User wallets: list, details, create, and lookup by address' },
      { name: 'Lending', description: 'Loan creation & repayment' },
      { name: 'Savings', description: 'Savings accounts & term locking' },
      { name: 'Exchange', description: 'Crypto swaps & coin voting' },
      { name: 'Notifications', description: 'Send in-app/email/SMS notifications (demo)' },
      { name: 'Admin Auth', description: 'Admin authentication (register/login/OTP)' },
      { name: 'Admin', description: 'Admin operations (profiles, users, KYC, settings, lists)' },
      { name: 'Admin Assets', description: 'Asset management for admins' },
      { name: 'Admin Chat', description: 'Admin chat REST and WebSocket' },
      { name: 'Webhooks', description: 'Inbound callbacks: Shufti Pro and Tatum deposits' },
      { name: 'Referrals', description: 'Referral endpoints for users' },
      { name: 'Calculator', description: 'Referral profit calculator' },
      { name: 'Prices', description: 'Public crypto prices' },
      { name: 'Dashboard', description: 'Aggregated user dashboard data' },
    ],
    components: {
      securitySchemes: {
        BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    paths: {
      // ----- Auth -----
'/api/v1/auth/register': {
        post: {
          tags: ['Auth'],
          summary: 'Register a new user',
          description:
            'Creates a user account. In DEVELOPMENT (via CURRENT_ENVIRONMENT), email/phone/KYC are auto-verified and OTP email is skipped.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['title', 'fullName', 'dateOfBirth', 'email', 'password'],
                  properties: {
                    title: { type: 'string', example: 'Mr' },
                    fullName: { type: 'string', example: 'John Doe' },
                    dateOfBirth: { type: 'string', description: 'DD/MM/YYYY', example: '01/01/1990' },
                    email: { type: 'string', format: 'email' },
                    phone: { type: 'string', description: 'Optional E.164 phone' },
                    password: { type: 'string', minLength: 8 },
                    referrer: { type: 'string', description: 'Optional referral code' },
                  },
                },
              },
            },
          },
          responses: {
'200': { description: 'User registered successfully', content: { 'application/json': { example: { message: 'User registered successfully', userId: '65a6f7e7f7f7f7f7f7f7f7f7' } } } },
            '409': { description: 'User already exists' },
          },
        },
      },
'/api/v1/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Initiate login',
          description: 'Starts login flow. In DEVELOPMENT, OTP is skipped; otherwise an OTP is sent to email/phone.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['password'],
                  properties: {
                    email: { type: 'string', format: 'email', description: 'Provide either email or phone' },
                    phone: { type: 'string', description: 'E.164 format; provide either email or phone' },
                    password: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
'200': { description: 'OTP sent or bypassed (DEV mode)', content: { 'application/json': { example: { message: 'An OTP has been sent to your email/phone.', userId: '65a6f7e7f7f7f7f7f7f7f7f7' } } } },
            '401': { description: 'Invalid credentials or user unverified' },
          },
        },
      },
'/api/v1/auth/verify-login': {
        post: {
          tags: ['Auth'],
          summary: 'Verify login with OTP (or bypass in dev)',
          description: 'Verifies the login OTP and returns access/refresh tokens. In DEVELOPMENT, OTP check is bypassed.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['userId', 'otp', 'clientDevice'],
                  properties: {
                    userId: { type: 'string' },
                    otp: { type: 'string', description: '6-digit OTP (ignored in DEVELOPMENT)' },
                    clientDevice: { type: 'string', enum: ['web', 'mobile'] },
                  },
                },
              },
            },
          },
          responses: {
'200': { description: 'Access token (and refresh token via cookie for web clients)', content: { 'application/json': { example: { accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' } } } },
'400': { description: 'Invalid or expired OTP (non-dev)' },
          },
        },
      },

      // Email & Phone Verification flows
'/api/v1/auth/verify/email': {
        post: {
          tags: ['Auth'],
          summary: 'Verify email with OTP',
          description: 'Confirms a user\'s email using a 6-digit OTP sent on registration.',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', required: ['userId', 'otp'], properties: { userId: { type: 'string' }, otp: { type: 'string' } } } } }
          },
          responses: { '200': { description: 'Email verified' }, '400': { description: 'Invalid/expired OTP' }, '404': { description: 'User not found' } },
        },
      },
'/api/v1/auth/send/phone': {
        post: {
          tags: ['Auth'],
          summary: 'Send phone verification OTP',
          description: 'Sends a 6-digit OTP via SMS for phone verification with rate limiting.',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['userId'], properties: { userId: { type: 'string' } } } } } },
          responses: { '200': { description: 'OTP sent' }, '400': { description: 'User not found or already verified' } },
        },
      },
'/api/v1/auth/verify/phone': {
        post: {
          tags: ['Auth'],
          summary: 'Verify phone with OTP',
          description: 'Confirms a user\'s phone using the OTP. In DEVELOPMENT (via CURRENT_ENVIRONMENT), OTP checks are bypassed.',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['userId', 'otp'], properties: { userId: { type: 'string' }, otp: { type: 'string' } } } } } },
          responses: { '200': { description: 'Phone verified' }, '400': { description: 'Invalid/expired OTP' }, '404': { description: 'User not found' } },
        },
      },
      '/api/v1/auth/edit-phone': {
        post: {
          tags: ['Auth'],
          summary: 'Edit phone number',
          description: 'Updates phone number before verification completes.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['userId', 'phone'],
                  properties: {
                    userId: { type: 'string', description: 'User ID (24-hex)' },
                    phone: { type: 'string', description: 'E.164 phone, e.g. +15551234567' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Phone updated' }, '404': { description: 'User not found' } },
        },
      },

      // KYC flows (Shufti Pro)
'/api/v1/auth/kyc/document': {
        post: {
          tags: ['Auth'],
          summary: 'Upload KYC document',
          description: 'Uploads a document image via multipart/form-data.',
          requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', required: ['userId', 'proof'], properties: { userId: { type: 'string' }, proof: { type: 'string', format: 'binary' } } } } } },
          responses: { '200': { description: 'Document uploaded' }, '400': { description: 'Missing proof' } },
        },
      },
'/api/v1/auth/kyc/face': {
        post: {
          tags: ['Auth'],
          summary: 'Upload KYC face proof',
          description: 'Uploads a face image via multipart/form-data.',
          requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', required: ['userId', 'proof'], properties: { userId: { type: 'string' }, proof: { type: 'string', format: 'binary' } } } } } },
          responses: { '200': { description: 'Face proof uploaded' }, '400': { description: 'Missing proof' } },
        },
      },
'/api/v1/auth/kyc/address': {
        post: {
          tags: ['Auth'],
          summary: 'Submit KYC address details',
          description: 'Saves the user\'s full address for KYC.',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['userId', 'fullAddress'], properties: { userId: { type: 'string' }, fullAddress: { type: 'string' } } } } } },
          responses: { '200': { description: 'Address saved' }, '400': { description: 'User already verified' } },
        },
      },
'/api/v1/auth/kyc/consent': {
        post: {
          tags: ['Auth'],
          summary: 'Upload KYC consent proof',
          description: 'Uploads a consent image via multipart/form-data with optional consent text.',
          requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', required: ['userId', 'proof'], properties: { userId: { type: 'string' }, text: { type: 'string' }, proof: { type: 'string', format: 'binary' } } } } } },
          responses: { '200': { description: 'Consent uploaded' }, '400': { description: 'Missing proof' } },
        },
      },
'/api/v1/auth/kyc/submit': {
        post: {
          tags: ['Auth'],
          summary: 'Submit KYC for verification',
          description: 'Submits KYC to Shufti for verification; status can be PENDING, APPROVED, or FAILED.',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['userId'], properties: { userId: { type: 'string' } } } } } },
          responses: { '200': { description: 'KYC submitted' }, '404': { description: 'User not found' } },
        },
      },
      '/api/v1/auth/kyc/status': {
        get: {
          tags: ['Auth'],
          summary: 'Get KYC status',
          description: 'Fetches latest KYC status; can poll to see updates from Shufti.',
responses: { '200': { description: 'Current KYC status returned', content: { 'application/json': { example: { status: 'APPROVED', verificationDetails: { event: 'verification.accepted' } } } } } },
        },
      },

      // Password resets
'/api/v1/auth/request-password-reset': {
        post: {
          tags: ['Auth'],
          summary: 'Request password reset OTP',
          description: 'Sends a short OTP to email or phone for password reset (rate limited).',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string', format: 'email' }, phone: { type: 'string' } }, description: 'Provide either email or phone' } } } },
          responses: { '200': { description: 'Reset requested' }, '404': { description: 'User not found' } },
        },
      },
'/api/v1/auth/validate-password-reset-otp': {
        post: {
          tags: ['Auth'],
          summary: 'Validate password reset OTP',
          description: 'Validates the OTP and allows password change in a subsequent call.',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['userId', 'otp'], properties: { userId: { type: 'string' }, otp: { type: 'string' } } } } } },
          responses: { '200': { description: 'OTP valid' }, '400': { description: 'Invalid/expired OTP' } },
        },
      },
'/api/v1/auth/set-password': {
        post: {
          tags: ['Auth'],
          summary: 'Set new password (after OTP validation)',
          description: 'Sets a new password if password reset has been permitted.',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['userId', 'password'], properties: { userId: { type: 'string' }, password: { type: 'string', minLength: 8 } } } } } },
          responses: { '200': { description: 'Password set successfully' }, '400': { description: 'Password reset not allowed' } },
        },
      },
'/api/v1/auth/refresh-token': {
        post: {
          tags: ['Auth'],
          summary: 'Refresh access token',
          description: 'Refreshes access token using a valid refresh token (cookie for web, body for mobile).',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['refreshToken', 'clientDevice'], properties: { refreshToken: { type: 'string' }, clientDevice: { type: 'string', enum: ['web', 'mobile'] } } } } } },
          responses: { '200': { description: 'New access/refresh tokens issued' }, '401': { description: 'Invalid/expired refresh token' } },
        },
      },
      '/api/v1/auth/logout': {
        post: {
          tags: ['Auth'],
          summary: 'Logout user',
          description: 'Clears refresh tokens; deletes cookie for web clients. Requires Bearer token.',
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['clientDevice'],
                  properties: {
                    clientDevice: { type: 'string', enum: ['web', 'mobile'], description: 'Client type affects cookie behavior' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Logged out' }, '401': { description: 'Unauthorized' } },
        },
      },

      // ----- Users -----
      '/api/v1/users/profile': {
        get: {
          tags: ['Users'],
          summary: 'Get user profile',
          description: 'Returns basic profile data for the authenticated user.',
          security: [{ BearerAuth: [] }],
responses: { '200': { description: 'Profile returned', content: { 'application/json': { example: { _id: '65a6f7e7f7f7f7f7f7f7f7f7', fullName: 'John Doe', email: 'john@example.com', phoneNumber: '+15551234567', isKycVerified: true, accountStatus: 'ACTIVE' } } } }, '401': { description: 'Unauthorized' } },
        },
        put: {
          tags: ['Users'],
summary: 'Update user profile',
          description: 'Updates basic profile fields for the authenticated user (partial updates allowed).',
          security: [{ BearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { title: { type: 'string' }, fullName: { type: 'string' }, dateOfBirth: { type: 'string', description: 'DD/MM/YYYY' }, phoneNumber: { type: 'string' } } } } } },
responses: { '200': { description: 'Profile updated', content: { 'application/json': { example: { message: 'Profile updated successfully', user: { _id: '65a6f7e7f7f7f7f7f7f7f7f7', fullName: 'John Doe', title: 'Mr', dateOfBirth: '01/01/1990' } } } } }, '401': { description: 'Unauthorized' } },
        },
      },
      '/api/v1/users/request-password-change': {
        post: {
          tags: ['Users'],
summary: 'Request password change (logged-in flow)',
          description: 'Sends an OTP to confirm password change for a logged-in user.',
          security: [{ BearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } } } } },
          responses: { '200': { description: 'OTP sent' } },
        },
      },
      '/api/v1/users/validate-password-change-otp': {
        post: {
          tags: ['Users'],
summary: 'Validate password change OTP',
          description: 'Validates the OTP to allow password change.',
          security: [{ BearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['userId', 'otp'], properties: { userId: { type: 'string' }, otp: { type: 'string' } } } } } },
          responses: { '200': { description: 'OTP valid' }, '400': { description: 'Invalid/expired OTP' } },
        },
      },
      '/api/v1/users/update-password-change': {
        post: {
          tags: ['Users'],
summary: 'Update password (after validation)',
          description: 'Sets the new password for the logged-in user.',
          security: [{ BearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['userId', 'password'], properties: { userId: { type: 'string' }, password: { type: 'string', minLength: 8 } } } } } },
          responses: { '200': { description: 'Password updated' } },
        },
      },
      '/api/v1/users/request-email-change': {
        post: {
          tags: ['Users'],
summary: 'Request email change (logged-in flow)',
          description: 'Starts email change flow by sending an OTP to the new email address.',
          security: [{ BearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['newEmail'], properties: { newEmail: { type: 'string', format: 'email' } } } } } },
          responses: { '200': { description: 'OTP sent to new email' } },
        },
      },
      '/api/v1/users/validate-email-change-otp': {
        post: {
          tags: ['Users'],
summary: 'Validate email change OTP',
          description: 'Validates the OTP before updating email to the new address.',
          security: [{ BearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['userId', 'otp'], properties: { userId: { type: 'string' }, otp: { type: 'string' } } } } } },
          responses: { '200': { description: 'OTP valid' }, '400': { description: 'Invalid/expired OTP' } },
        },
      },
      '/api/v1/users/update-email-change': {
        post: {
          tags: ['Users'],
summary: 'Update email (after validation)',
          description: 'Updates the user\'s email to the new address after OTP validation.',
          security: [{ BearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['userId', 'newEmail'], properties: { userId: { type: 'string' }, newEmail: { type: 'string', format: 'email' } } } } } },
          responses: { '200': { description: 'Email updated' } },
        },
      },

      // ----- Wallets -----
      '/api/v1/wallets': {
        get: {
          tags: ['Wallets'],
          summary: 'List wallets for user',
          description: 'Lists all wallets owned by the authenticated user.',
          security: [{ BearerAuth: [] }],
responses: { '200': { description: 'Wallet list', content: { 'application/json': { example: [{ _id: '65a6f7e7f7f7f7f7f7f7f7f7', assetId: '65a6f7e7f7f7f7f7f7f7f7f6', address: '0xabc...', balance: 0.5, network: 'ETH' }] } } }, '401': { description: 'Unauthorized' } },
        },
        post: {
          tags: ['Wallets'],
summary: 'Create a wallet',
          description: 'Creates a new wallet for the specified asset symbol if not already present.',
          security: [{ BearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['assetSymbol'], properties: { assetSymbol: { type: 'string', description: 'Asset symbol, e.g., BTC, ETH' } } } } } },
responses: { '201': { description: 'Wallet created', content: { 'application/json': { example: { message: 'Wallet created successfully', wallet: { _id: '65a6f7e7f7f7f7f7f7f7f7f7', assetId: '65a6f7e7f7f7f7f7f7f7f7f6', address: 'btc_address_65a6...', balance: 0 } } } } }, '409': { description: 'Wallet already exists' } },
        },
      },
      '/api/v1/wallets/{id}': {
        get: {
          tags: ['Wallets'],
          summary: 'Get wallet details',
          description: 'Returns wallet details for a given wallet ID belonging to the authenticated user.',
          security: [{ BearerAuth: [] }],
responses: { '200': { description: 'Asset listed', content: { 'application/json': { example: { message: 'Asset listed', asset: { _id: '65a...', status: 'LISTED' } } } } }, '404': { description: 'Asset not found' },
        },
      },
      '/api/v1/wallets/address/{walletAddress}': {
        get: {
          tags: ['Wallets'],
          summary: 'Get wallet by blockchain address',
          description: 'Finds a wallet using its on-chain address.',
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'Wallet' }, '404': { description: 'Wallet not found' } },
        },
      },

      // ----- Lending -----
      '/api/v1/lending/loans': {
        post: {
          tags: ['Lending'],
          summary: 'Create a loan',
description:
            'Creates a loan requiring a termDays and applies asset-based interest by user accountType (REG/PRO) and term.',
          security: [{ BearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['assetId','amount','collateralAssetId','collateralAmount','termDays'], properties: { assetId: { type: 'string' }, amount: { type: 'number' }, collateralAssetId: { type: 'string' }, collateralAmount: { type: 'number' }, termDays: { type: 'integer', enum: [7,30,180,365] } } } } } },
          responses: {
'200': { description: 'Loan created', content: { 'application/json': { example: { message: 'Loan created successfully', loan: { _id: '65a...', userId: '65a...', loanAssetId: '65b...', loanAmount: 100, collateralAssetId: '65c...', collateralAmount: 0.01, ltv: 0.5, interestRate: 5, termDays: 30, status: 'ACTIVE' } } } } },
'400': { description: 'Invalid asset or insufficient collateral' },
          },
        },
      },
      '/api/v1/lending/loans/{id}/repay': {
        post: {
          tags: ['Lending'],
          summary: 'Repay a loan',
description: 'Repays principal for an active loan. If fully repaid, collateral is returned.',
          security: [{ BearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['amount'], properties: { amount: { type: 'number' } } } } } },
responses: { '200': { description: 'Loan repaid', content: { 'application/json': { example: { message: 'Loan repaid successfully', loan: { _id: '65a...', loanAmount: 50, status: 'ACTIVE' } } } } }, '404': { description: 'Loan not found' }, '400': { description: 'Invalid amount' } },
        },
      },
      '/api/v1/savings': {
        post: {
          tags: ['Savings'],
          summary: 'Create savings account',
description:
            'Creates a savings account with termDays; APY is pulled from asset.savingsInterest[term]; funds are locked until lockEndAt.',
          security: [{ BearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['assetId','amount','termDays'], properties: { assetId: { type: 'string' }, amount: { type: 'number' }, termDays: { type: 'integer', enum: [7,30,180,365] } } } } } },
          responses: {
'200': { description: 'Savings account created', content: { 'application/json': { example: { message: 'Savings account created successfully', savingsAccount: { _id: '65a...', assetId: '65b...', balance: 1.5, apy: 6, termDays: 30, lockStartAt: '2025-09-01T00:00:00Z', lockEndAt: '2025-10-01T00:00:00Z' } } } } },
'400': { description: 'Asset not found/available or insufficient wallet balance' },
          },
        },
      },
      '/api/v1/savings/{id}/deposit': {
        post: {
          tags: ['Savings'],
          summary: 'Deposit into savings',
          description: 'Transfers funds from wallet to savings account.',
          security: [{ BearerAuth: [] }],
responses: { '200': { description: 'Deposit successful', content: { 'application/json': { example: { message: 'Deposit successful', savingsAccount: { _id: '65a...', balance: 2.5 } } } } }, '404': { description: 'Savings account not found' }, '400': { description: 'Insufficient balance' } },
        },
      },
      '/api/v1/savings/{id}/withdraw': {
        post: {
          tags: ['Savings'],
          summary: 'Withdraw from savings',
          description: 'Transfers funds from savings back to wallet. Locked accounts cannot withdraw until lockEndAt.',
          security: [{ BearerAuth: [] }],
responses: { '200': { description: 'Withdrawal successful', content: { 'application/json': { example: { message: 'Withdrawal successful', savingsAccount: { _id: '65a...', balance: 1.0 } } } } }, '404': { description: 'Savings account not found' }, '400': { description: 'Insufficient balance or locked' } },
        },
      },
      '/api/v1/exchange/swap': {
        post: {
          tags: ['Exchange'],
          summary: 'Swap crypto',
description:
            'Swaps from one asset to another. Applies split fees: fromAsset.fees.exchangeFeePercentFrom and toAsset.fees.exchangeFeePercentTo. Deducts amount+fromFee, credits net (converted - toFee).',
          security: [{ BearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['fromAssetId','toAssetId','amount'], properties: { fromAssetId: { type: 'string' }, toAssetId: { type: 'string' }, amount: { type: 'number' } } } } } },
          responses: {
'200': { description: 'Swap successful', content: { 'application/json': { example: { message: 'Swap successful', amount: 1, convertedAmount: 2000, fromFeePercent: 0.2, toFeePercent: 0.3, fromFeeAmount: 0.002, toFeeAmount: 6, netReceived: 1994 } } } },
'400': { description: 'Asset invalid/unavailable or insufficient balance' },
          },
        },
      },
      '/api/v1/exchange/vote': {
        post: {
          tags: ['Exchange'],
          summary: 'Vote for coin listing',
description: 'Users can vote for coins to be listed. Admins may review and list/delist later.',
          security: [{ BearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['coinName'], properties: { coinName: { type: 'string' } } } } } },
          responses: { '200': { description: 'Vote recorded' } },
        },
      },

      // ----- Notifications -----
      '/api/v1/notifications': {
        post: {
          tags: ['Notifications'],
          summary: 'Send a test notification',
description: 'Sends a notification (demo) to the authenticated user via configured channels.',
          security: [{ BearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['userId','message','type'], properties: { userId: { type: 'string' }, message: { type: 'string' }, type: { type: 'string', enum: ['email','sms'] } } } } } },
          responses: { '200': { description: 'Notification sent' } },
        },
      },

      // ----- Admin Auth -----
      '/api/v1/admin/auth/register': {
        post: {
          tags: ['Admin Auth'],
          summary: 'Register an admin',
description: 'Creates a new admin user and initializes liquidity wallet system.',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['role','fullName','username','email','secondaryEmail','password'], properties: { role: { type: 'string', enum: ['ADMIN','SUPER_ADMIN'] }, fullName: { type: 'string' }, username: { type: 'string' }, email: { type: 'string', format: 'email' }, secondaryEmail: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 8 } } } } } },
          responses: { '201': { description: 'Admin registered' }, '409': { description: 'Admin exists' } },
        },
      },
      '/api/v1/admin/auth/send-phone-otp': {
        post: {
          tags: ['Admin Auth'],
          summary: 'Send admin phone OTP',
description: 'Sends OTP to an admin\'s phone to verify number.',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['userId','phone'], properties: { userId: { type: 'string' }, phone: { type: 'string' } } } } } },
          responses: { '200': { description: 'OTP sent' }, '404': { description: 'Admin not found' } },
        },
      },
      '/api/v1/admin/auth/verify-phone-otp': {
        post: {
          tags: ['Admin Auth'],
          summary: 'Verify admin phone OTP',
description: 'Verifies admin phone using OTP. In DEVELOPMENT, OTP is bypassed.',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['userId','otp','phone'], properties: { userId: { type: 'string' }, otp: { type: 'string' }, phone: { type: 'string' } } } } } },
          responses: { '200': { description: 'Phone verified' }, '400': { description: 'Invalid/expired OTP' } },
        },
      },
      '/api/v1/admin/auth/login': {
        post: {
          tags: ['Admin Auth'],
          summary: 'Admin login',
description: 'Starts admin login flow. In DEVELOPMENT, tokens are issued immediately (no OTP).',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email','password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } } } } } },
          responses: { '200': { description: 'OTP sent or tokens issued (DEV)' }, '401': { description: 'Invalid credentials' } },
        },
      },
      '/api/v1/admin/auth/verify-login': {
        post: {
          tags: ['Admin Auth'],
          summary: 'Verify admin login OTP',
description: 'Verifies admin login OTP and returns tokens. In DEVELOPMENT, OTP is bypassed.',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['userId','otp'], properties: { userId: { type: 'string' }, otp: { type: 'string' } } } } } },
          responses: { '200': { description: 'Access token (and refresh cookie for web)' }, '400': { description: 'Invalid/expired OTP' } },
        },
      },
      '/api/v1/admin/auth/logout': {
        post: {
          tags: ['Admin Auth'],
          summary: 'Admin logout',
description: 'Logs out admin and deletes refresh tokens.',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['refreshToken'], properties: { refreshToken: { type: 'string' } } } } } },
          responses: { '200': { description: 'Logged out' } },
        },
      },

      // ----- Admin -----
      '/api/v1/admin/profile': {
        get: {
          tags: ['Admin'],
          summary: 'Get admin profile',
          description: 'Returns the authenticated admin\'s profile.',
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'Admin profile' }, '401': { description: 'Unauthorized' } },
        },
      },
      '/api/v1/admin/profile/avatar': {
        put: {
          tags: ['Admin'],
summary: 'Upload admin avatar',
          description: 'Uploads an image as base64 data URL (max 3MB).',
          security: [{ BearerAuth: [] }],
          requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', required: ['avatar'], properties: { avatar: { type: 'string', format: 'binary' } } } } } },
          responses: { '200': { description: 'Avatar uploaded' } },
        },
        delete: {
          tags: ['Admin'],
          summary: 'Delete admin avatar',
          description: 'Removes the admin\'s profile avatar.',
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'Avatar removed' } },
        },
      },
      '/api/v1/admin/users/block': {
        post: {
          tags: ['Admin'],
          summary: 'Block a user',
description: 'Blocks a user by email or phone; sets accountStatus=BLOCKED and ends sessions.',
          security: [{ BearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string', format: 'email' }, phone: { type: 'string' } }, description: 'Provide either email or phone' } } } },
          responses: { '200': { description: 'User blocked' }, '404': { description: 'User not found' } },
        },
      },
      '/api/v1/admin/users/unblock': {
        post: {
          tags: ['Admin'],
          summary: 'Unblock a user',
description: 'Unblocks a user; restores accountStatus=ACTIVE.',
          security: [{ BearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string', format: 'email' }, phone: { type: 'string' } }, description: 'Provide either email or phone' } } } },
          responses: { '200': { description: 'User unblocked' }, '404': { description: 'User not found' } },
        },
      },
      '/api/v1/admin/users/blocked': {
        get: {
          tags: ['Admin'],
          summary: 'List blocked users',
          description: 'Paginated list of blocked users with blockedAt and blockedBy.',
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'Blocked users list' } },
        },
      },
      '/api/v1/admin/kyc': {
        get: {
          tags: ['Admin'],
          summary: 'List KYC records',
          description: 'Paginated list of users and their KYC documents/status.',
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'KYC users' } },
        },
      },
      '/api/v1/admin/settings': {
        get: {
          tags: ['Admin'],
          summary: 'Get system settings',
          description: 'Returns global settings such as savings APY.',
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'Settings' } },
        },
      },
      '/api/v1/admin/settings/savings-apy': {
        put: {
          tags: ['Admin'],
          summary: 'Update savings APY (global)',
description: 'Sets the global savings APY value.',
          security: [{ BearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['savingsApy'], properties: { savingsApy: { type: 'number' } } } } } },
          responses: { '200': { description: 'APY updated' } },
        },
      },
      '/api/v1/admin/invite': {
        post: {
          tags: ['Admin'],
          summary: 'Invite admin (Super Admin only)',
description: 'Sends an admin invitation email with a token. Requires SUPER_ADMIN role.',
          security: [{ BearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' }, role: { type: 'string', enum: ['ADMIN','SUPER_ADMIN'] } } } } } },
          responses: { '200': { description: 'Invitation sent' }, '409': { description: 'Admin exists' } },
        },
      },
      '/api/v1/admin/users': {
        get: {
          tags: ['Admin'],
          summary: 'List users',
          description: 'Lists all users for administrative purposes.',
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'Users list' } },
        },
      },
      '/api/v1/admin/loans': {
        get: {
          tags: ['Admin'],
          summary: 'List loans',
          description: 'Lists all loans in the system.',
          security: [{ BearerAuth: [] }],
responses: { '200': { description: 'List of assets', content: { 'application/json': { example: { data: [{ _id: '65a...', symbol: 'BTC', network: 'ETH', status: 'LISTED' }], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } } } } },
        },
      },
      '/api/v1/admin/savings': {
        get: {
          tags: ['Admin'],
          summary: 'List savings',
          description: 'Lists all savings accounts.',
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'Savings list' } },
        },
      },
      '/api/v1/admin/transactions': {
        get: {
          tags: ['Admin'],
          summary: 'List transactions',
          description: 'Lists all transactions (deposits, withdrawals, swaps, etc.).',
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'Transactions list' } },
        },
      },

      // ----- Admin Assets -----
      '/api/v1/admin/assets': {
        post: {
          tags: ['Admin Assets'],
          summary: 'Create asset',
description:
            'Create a new asset. For tokens, provide tokenAddress and decimals. Supports split exchange fees (from/to).',
          security: [{ BearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name','symbol','iconUrl','currentPrice','marketCap','circulatingSupply','network','kind','fees'], properties: { name: { type: 'string' }, symbol: { type: 'string' }, iconUrl: { type: 'string' }, currentPrice: { type: 'number' }, marketCap: { type: 'number' }, circulatingSupply: { type: 'number' }, amountHeld: { type: 'number' }, isLendable: { type: 'boolean' }, isCollateral: { type: 'boolean' }, network: { type: 'string', enum: ['ETH','BSC','TRON','BTC','LTC'] }, kind: { type: 'string', enum: ['native','erc20','trc20'] }, tokenAddress: { type: 'string' }, decimals: { type: 'number' }, status: { type: 'string', enum: ['LISTED','PENDING_VOTES','DELISTED'] }, fees: { type: 'object', properties: { sendFeePercent: { type: 'number' }, receiveFeePercent: { type: 'number' }, exchangeFeePercentFrom: { type: 'number' }, exchangeFeePercentTo: { type: 'number' }, referralFeePercent: { type: 'number' }, loanInterest: { type: 'object' }, savingsInterest: { type: 'object' } } } } } } } },
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
            '200': { description: 'Asset', content: { 'application/json': { example: { _id: '65a...', symbol: 'ETH', network: 'ETH', status: 'LISTED' } } } },
            '404': { description: 'Asset not found' },
          },
        },
put: {
          tags: ['Admin Assets'],
          summary: 'Update asset',
          description: 'Update asset fields, including fees and status. Partial updates allowed.',
          security: [{ BearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, symbol: { type: 'string' }, iconUrl: { type: 'string' }, currentPrice: { type: 'number' }, marketCap: { type: 'number' }, circulatingSupply: { type: 'number' }, amountHeld: { type: 'number' }, isLendable: { type: 'boolean' }, isCollateral: { type: 'boolean' }, network: { type: 'string', enum: ['ETH','BSC','TRON','BTC','LTC'] }, kind: { type: 'string', enum: ['native','erc20','trc20'] }, tokenAddress: { type: 'string' }, decimals: { type: 'number' }, status: { type: 'string', enum: ['LISTED','PENDING_VOTES','DELISTED'] }, fees: { type: 'object' } } } } } },
responses: { '200': { description: 'Asset updated', content: { 'application/json': { example: { message: 'Asset updated', asset: { _id: '65a...', symbol: 'USDT', network: 'ETH' } } } } }, '404': { description: 'Asset not found' }, '409': { description: 'Duplicate' } },
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

      // ----- Admin Chat -----
      '/api/v1/admin/chat/messages': {
        get: {
          tags: ['Admin Chat'],
          summary: 'List chat messages',
          description: 'Returns paginated admin chat messages ordered by time.',
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'Messages list' } },
        },
post: {
          tags: ['Admin Chat'],
          summary: 'Send chat message',
          description: 'Sends a new admin chat message.',
          security: [{ BearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['peerId','text'], properties: { peerId: { type: 'string' }, text: { type: 'string' } } } } } },
          responses: { '200': { description: 'Message sent' } },
        },
      },
      '/api/v1/admin/chat/ws': {
        get: {
          tags: ['Admin Chat'],
          summary: 'Chat WebSocket',
          description: 'WebSocket endpoint for realtime admin-to-admin chat.',
          responses: { '101': { description: 'Switching Protocols' } },
        },
      },

      // ----- Webhooks -----
      '/api/v1/webhooks/shufti/callback': {
        post: {
          tags: ['Webhooks'],
          summary: 'Shufti Pro callback',
          description: 'Receives KYC verification events from Shufti Pro and updates user records.',
          responses: { '200': { description: 'Callback processed' } },
        },
      },
      '/api/v1/webhooks/shufti/redirect': {
        get: {
          tags: ['Webhooks'],
          summary: 'Shufti Pro redirect',
          description: 'User browser redirect endpoint after KYC flow on Shufti Pro.',
          responses: { '200': { description: 'HTML redirect page' } },
        },
      },
      '/api/v1/webhooks/tatum': {
        post: {
          tags: ['Webhooks'],
          summary: 'Tatum deposit webhook',
description: 'Receives deposit notifications from Tatum (INCOMING_NATIVE_TX / INCOMING_FUNGIBLE_TX). Applies receiveFee to credit net balance and records transactions.',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { address: { type: 'string' }, amount: { type: 'string' }, txId: { type: 'string' }, chain: { type: 'string' }, subscriptionType: { type: 'string' }, contractAddress: { type: 'string' }, blockNumber: { type: 'number' } } } } } },
          responses: { '200': { description: 'Webhook accepted' } },
        },
      },

      // ----- Referrals -----
      '/api/v1/referrals': {
        get: {
          tags: ['Referrals'],
          summary: 'List user referrals',
          description: 'Returns the list of users referred by the authenticated user.',
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'Referrals list' } },
        },
      },
      '/api/v1/referrals/earnings': {
        get: {
          tags: ['Referrals'],
          summary: 'Get referral earnings',
          description: 'Returns the total referral earnings for the authenticated user.',
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'Earnings returned' } },
        },
      },
      '/api/v1/referrals/test-email': {
        post: {
          tags: ['Referrals'],
          summary: 'Send a test referral email',
          description: 'Sends a test referral email to the authenticated user.',
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'Email sent' } },
        },
      },

      // ----- Calculator -----
      '/api/v1/calculator': {
        post: {
          tags: ['Calculator'],
          summary: 'Calculate referral profit',
description: 'Returns an estimated profit calculation based on referral inputs.',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['amount','referrals'], properties: { amount: { type: 'number' }, referrals: { type: 'number' } } } } } },
          responses: { '200': { description: 'Calculation returned' } },
        },
      },

      // ----- Prices -----
      '/api/v1/prices': {
        get: {
          tags: ['Prices'],
          summary: 'Get crypto prices',
          description: 'Returns current crypto prices and related market data.',
          responses: { '200': { description: 'Prices returned' } },
        },
      },

      // ----- Dashboard -----
      '/api/v1/dashboard': {
        get: {
          tags: ['Dashboard'],
          summary: 'Get dashboard data',
          description: 'Aggregated portfolio, loans, savings, and recent activity for the user.',
          security: [{ BearerAuth: [] }],
          responses: { '200': { description: 'Dashboard data' } },
        },
      },
    }
  }

  // Serve the OpenAPI JSON
  app.get('/api/v1/docs', (c) => c.json(openApiDoc))
  // Serve Swagger UI referencing the JSON endpoint
  app.get('/api/v1/docs/ui', swaggerUI({ url: '/api/v1/docs' }))
}

