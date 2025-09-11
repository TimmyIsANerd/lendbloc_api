# Technology Stack

## Runtime & Framework
- **Runtime**: Bun (JavaScript/TypeScript runtime)
- **Framework**: Hono (lightweight web framework)
- **Language**: TypeScript with strict type checking

## Database & ODM
- **Database**: MongoDB
- **ODM**: Mongoose for schema modeling and validation

## Validation & Security
- **Validation**: Zod schemas for request/response validation
- **Authentication**: JWT tokens with refresh token rotation
- **Middleware**: Custom auth middleware with account status checks
- **Encryption**: AES-256-GCM for sensitive data encryption

## External Services
- **Email**: Mailtrap for email delivery
- **SMS**: Twilio for SMS notifications
- **KYC**: Shufti Pro for identity verification
- **Blockchain**: Tatum SDK for multi-chain wallet operations
- **Crypto Libraries**: Noble secp256k1, BIP32/39 for wallet generation

## Development Tools
- **Package Manager**: Bun
- **API Documentation**: Swagger UI with Zod OpenAPI integration
- **Rate Limiting**: hono-rate-limiter for API protection

## Common Commands

```bash
# Development
bun install              # Install dependencies
bun run start           # Start development server with watch mode
bun test               # Run test suite

# Database
bun run seed           # Seed database with test data
bun run seed:drop      # Drop and reseed database

# Production
bun run index.ts       # Start production server
```

## Environment Configuration
- Uses `.env` files for configuration
- Separate configs for development/production
- Required: MongoDB URI, JWT secrets, API keys for external services