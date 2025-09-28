---
inclusion: always
---

# Project Structure & Architecture Guidelines

## Mandatory Module Structure
When creating new features, ALWAYS follow the 4-file pattern:

```
src/modules/{feature}/
├── {feature}.routes.ts      # Hono route definitions with middleware
├── {feature}.controller.ts  # Business logic handlers (async functions)
├── {feature}.validation.ts  # Zod schemas for input/output validation
└── {feature}.test.ts       # Test cases using Bun test runner
```

## File Organization Rules
- **Controllers**: Export named async functions, handle request/response logic
- **Routes**: Import controller functions, apply middleware, define endpoints
- **Validation**: Export Zod schemas with descriptive names (e.g., `CreateUserSchema`)
- **Models**: Use Mongoose schemas, export as default with PascalCase names

## Directory Structure
```
src/
├── config/          # Database connection, environment setup
├── models/          # Mongoose schemas (User.ts, Loan.ts, etc.)
├── modules/         # Feature modules following 4-file pattern
├── middleware/      # Auth, validation, error handling middleware
├── helpers/         # External service integrations (Tatum, Twilio, etc.)
├── templates/       # Email/SMS templates
├── utils/           # Pure business logic functions
└── docs/           # Swagger/OpenAPI documentation
```

## Naming Conventions (Strictly Enforced)
- **Files**: kebab-case (`user-profile.controller.ts`)
- **Functions/Variables**: camelCase (`getUserBalance`)
- **Types/Interfaces**: PascalCase with `I` prefix (`IUserData`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_LOAN_AMOUNT`)
- **Database Models**: PascalCase (`User`, `LoanQuote`)
- **API Routes**: `/api/v1/{module}/{action}`

## Code Patterns to Follow

### Controller Pattern
```typescript
export const createUser = async (c: Context) => {
  const body = await c.req.json()
  const validated = CreateUserSchema.parse(body)
  // Business logic here
  return c.json({ success: true, data: result })
}
```

### Error Response Pattern
```typescript
return c.json({ 
  error: "Descriptive error message", 
  code: "ERROR_CODE" 
}, 400)
```

### Route Definition Pattern
```typescript
app.post('/create', authMiddleware, async (c) => createUser(c))
```

## Security Implementation Rules
- ALWAYS validate input with Zod schemas before processing
- Use JWT middleware for protected routes
- Apply rate limiting to auth endpoints (OTP, login, password reset)
- Encrypt sensitive data before database storage
- Return consistent error codes: `UNAUTHORIZED`, `MISSING_TOKEN`, `INVALID_INPUT`

## Database Interaction Guidelines
- Use Mongoose models for all database operations
- Implement proper error handling for database failures
- Use transactions for multi-document operations
- Follow the existing schema patterns in `src/models/`

## Testing Requirements
- Write tests for all controller functions
- Mock external service calls (Tatum, Twilio, etc.)
- Test both success and error scenarios
- Use descriptive test names that explain the scen