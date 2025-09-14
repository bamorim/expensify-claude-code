# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `pnpm dev` - Start development server with Turbo
- `pnpm build` - Build production application
- `pnpm start` - Start production server
- `pnpm preview` - Build and start in production mode

### Database Operations
- `pnpm db:generate` - Generate Prisma migrations for development
- `pnpm db:migrate` - Deploy Prisma migrations to production
- `pnpm db:push` - Push schema changes to database (dev/test)
- `pnpm db:push:test` - Push schema to test database
- `pnpm db:studio` - Open Prisma Studio on port 5555
- `pnpm db:studio:test` - Open Prisma Studio for test database on port 5556

### Code Quality & Testing
- `pnpm check` - Run linting and type checking
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Run ESLint with auto-fix
- `pnpm typecheck` - Run TypeScript type checking
- `pnpm format:check` - Check Prettier formatting
- `pnpm format:write` - Apply Prettier formatting
- `pnpm test` - Run all tests with Vitest
- `pnpm test:reset` - Reset test database

### Testing Environments
- **Server tests**: `src/server/**/*.test.ts` - Run in Node.js environment
- **App tests**: `src/app/**/*.test.{ts,tsx}` - Run in jsdom environment with React setup

## Architecture Overview

### T3 Stack Foundation
Built with create-t3-app using:
- **Next.js** with App Router
- **TypeScript** for type safety
- **Prisma** with PostgreSQL
- **tRPC** for end-to-end type-safe APIs
- **NextAuth** for authentication
- **Tailwind CSS** for styling
- **Vitest** for testing

### Project Structure
```
src/
├── app/                    # Next.js App Router pages and components
├── server/
│   ├── api/
│   │   ├── root.ts        # Main tRPC router
│   │   ├── trpc.ts        # tRPC configuration and middleware
│   │   └── routers/       # Domain-specific business logic
│   ├── auth/              # NextAuth configuration
│   └── db/                # Prisma client and test mocks
├── trpc/                  # Client-side tRPC setup
└── styles/                # Global styles
```

### Key Architectural Patterns

#### Business Logic in tRPC Routers
Business logic is organized directly within tRPC routers rather than separate service layers:
- Keeps architecture simple and focused
- Provides direct database access through Prisma
- Maintains full end-to-end type safety
- Simplifies testing with `createCaller`

#### Transactional Testing
Uses `@chax-at/transactional-prisma-testing` for database tests:
- Each test runs in its own transaction
- Automatic rollback prevents test contamination
- Real database operations with isolation
- Mock database client in `src/server/db/__mocks__/index.ts`

#### Multi-Environment Testing
Vitest configuration supports two test environments:
- **Node environment**: For server-side business logic tests
- **jsdom environment**: For React component tests with proper setup

### Development Guidelines

#### Testing Strategy
- **Test business logic** in tRPC procedures using transactional testing
- **Use `createCaller`** for end-to-end procedure testing
- **Keep component tests simple** - focus on stateless components
- **Prefer manual testing** for complex UI interactions
- **Test database operations** with real Prisma transactions

#### Code Organization
- Place business logic directly in tRPC routers
- Use Zod schemas for input validation
- Leverage Prisma for type-safe database operations
- Organize routers by domain/feature
- Keep authentication logic in NextAuth configuration

#### Environment Setup
- Copy `.env.example` to `.env` and configure
- Use `docker compose up -d` to start PostgreSQL
- Run `pnpm db:push` to sync schema to database
- Use separate test database configured in `.env.test`