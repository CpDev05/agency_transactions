
# agency_transactions — Backend Development Guidelines

## 1. Project objective
Build a secure REST API for a personal finance transaction management application.

## 2. Technology stack
- Node.js
- Express
- TypeScript
- MongoDB
- Mongoose
- Zod for request validation
- JWT for authentication
- bcryptjs for password hashing
- Docker and Docker Compose
- Vitest or Jest with Supertest for automated tests

Use compatible, stable package versions.

## 3. Architecture
Organize the backend by feature and responsibility.

backend/
  src/
    config/
    middlewares/
    modules/
      auth/
      transactions/
    app.ts
    server.ts
  tests/
  .env.example
  .gitignore
  Dockerfile
  package.json
  tsconfig.json

Separate routes, controllers, services, models and validation schemas when appropriate.

- Routes define endpoints.
- Controllers handle HTTP requests and responses.
- Services contain business logic.
- Models define MongoDB data structures.
- Middlewares handle authentication and errors.
- Config contains environment and database configuration.

Avoid unnecessary abstractions and duplicated code.

## 4. Authentication requirements
- Register users with name, email and password.
- Normalize email and prevent duplicate accounts.
- Hash passwords with bcryptjs before storing them.
- Authenticate users with email and password.
- Generate JWT access tokens.
- Protect private endpoints with authentication middleware.
- Read the JWT secret from environment variables.
- Never return password hashes in API responses.
- Validate authentication inputs.
- Return appropriate HTTP status codes for authentication errors.

## 5. Transaction requirements
Each transaction must include:
- description
- amount
- type: income or expense
- category
- date
- userId
- createdAt and updatedAt

Implement these endpoints:

POST   /api/transactions
GET    /api/transactions
GET    /api/transactions/:id
PATCH  /api/transactions/:id
DELETE /api/transactions/:id

Requirements:
- Every transaction belongs to an authenticated user.
- Users can only access and modify their own transactions.
- Validate IDs, amounts, dates, types and required fields.
- Support filters for type, category and date range.
- Use consistent response formats.
- Return appropriate status codes for created, successful, invalid, missing and unauthorized resources.

## 6. Dashboard summary
Implement GET /api/transactions/summary.

Return the authenticated user's:
- total income
- total expenses
- balance (income minus expenses)
- transaction count

Calculate these values from the database rather than trusting values sent by the frontend.

## 7. Validation and error handling
- Use Zod to validate request bodies and query parameters.
- Create centralized error-handling middleware.
- Do not expose stack traces or internal errors in production.
- Use correct HTTP status codes.
- Handle database connection errors.
- Never trust client-supplied userId for ownership decisions; derive the user identity from the verified JWT.

## 8. Environment variables
Provide a .env.example containing placeholders for:
- PORT
- MONGODB_URI
- JWT_SECRET
- NODE_ENV

Never commit a real .env file or secrets.

## 9. Docker
- Create a Dockerfile for the backend.
- Configure Docker Compose to run the backend and MongoDB.
- Use the MongoDB service name in the database connection string inside Docker.
- Add a health check if practical.
- Do not hardcode credentials or secrets.

## 10. Testing
Write tests for:
- Successful registration and login.
- Invalid credentials.
- Missing or invalid JWT.
- Creating, listing, updating and deleting transactions.
- Validation failures.
- Attempts to access another user's transactions.
- Dashboard summary calculations.

Use an isolated test database or a suitable test database strategy.

## 11. Development rules
- Use TypeScript strict mode.
- Keep controllers small and business logic in services.
- Use async/await and handle rejected promises.
- Avoid any unless justified.
- Keep dependencies minimal.
- Document setup, environment variables, scripts and endpoints in README.md.
- Do not implement unrelated features.
- Do not claim tests pass without running them.

## 12. Implementation workflow
Before changing files:
1. Inspect the existing repository and package configuration.
2. Identify missing information and potential risks.
3. Propose the architecture and implementation plan.
4. List the files to create or modify.
5. Define acceptance criteria and test strategy.

Wait for approval before implementing the plan.

Implement in small, verifiable stages. After each stage, run relevant tests and report the results, errors and next steps.
