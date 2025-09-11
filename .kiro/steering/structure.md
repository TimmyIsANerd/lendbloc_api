# Project Structure & Architecture

## Modular Architecture
The project follows a clean, modular architecture with clear separation of concerns:

```
src/
├── config/          # Database and configuration setup
├── models/          # Mongoose schemas and data models
├── modules/         # Feature modules (routes, controllers, validation, tests)
├── middleware/      # Authentication and request processing middleware
├── helpers/         # Utility functions and external service integrations
├── templates/       # Email templates
├── utils/           # Business logic utilities
└── docs/           # API documentation
```

## Module Structure Convention
Each feature module follows a consistent 4-file pattern:

```
src/modules/{feature}/
├── {feature}.routes.ts      # Route definitions with middleware
├── {feature}.controller.ts  # Business logic and request handling
├── {feature}.validation.ts  # Zod schemas for request validation
└── {feature}.test.ts       # Unit and integration tests
```

## Key Modules
- **auth**: User authentication, OTP, KYC workflows
- **users**: User profile management
- **wallets**: Crypto wallet operations
- **lending**: Loan creation and management
- **savings**: Savings account functionality
- **exchange**: Crypto swapping and voting
- **admin**: Administrative functions
- **notifications**: Email/SMS notification system

## Naming Conventions
- **Files**: kebab-case (e.g., `auth.controller.ts`)
- **Variables/Functions**: camelCase
- **Types/Interfaces**: PascalCase with `I` prefix for interfaces
- **Constants**: UPPER_SNAKE_CASE
- **Database Models**: PascalCase, exported as default

## Route Structure
- Base path: `/api/v1/{module}`
- RESTful conventions where applicable
- Consistent error response format with error codes
- Rate limiting on sensitive endpoints (OTP, password reset)

## Error Handling
- Standardized error responses with `error` and `code` fields
- HTTP status codes follow REST conventions
- Validation errors return 400 with descriptive messages
- Authentication errors use specific error codes (UNAUTHORIZED, MISSING_TOKEN, etc.)

## Security Patterns
- JWT tokens with 15-minute expiry
- Refresh tokens with 3-day expiry and rotation
- Rate limiting on authentication endpoints
- Input validation using Zod schemas
- Sensitive data encryption before database storage