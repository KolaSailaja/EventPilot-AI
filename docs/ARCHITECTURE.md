# Architecture Overview

## Stack
- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma ORM
- SQLite in local development
- NextAuth credentials authentication

## High-level architecture
The application is server-centric. Server Components read user-specific data from Prisma, and Server Actions authenticate and verify event ownership before mutations. Event reads also check the owner before rendering. The current code uses direct component-level Prisma access rather than a dedicated Data Access Layer; the Next.js data-security guide recommends a DAL for a larger/production application.

## Folder structure
- `app/` — route pages and API endpoints
- `components/` — reusable UI widgets and page sections
- `lib/` — shared utilities, validation, and server actions
- `prisma/` — Prisma schema and database configuration
- `docs/` — product and implementation documentation

## Authentication flow
1. User signs in using email and password credentials.
2. `auth.ts` validates credentials and returns a session user.
3. Protected routes rely on `auth()` and redirect signed-out users.
4. Server actions check event ownership before using write operations.

## Data model
The Prisma schema includes:
- User
- Event
- Expense
- Task
- Vendor
- Quotation
- Guest
- RSVP
- PlanSection
- ChangeProposal

This creates a rich event workspace while preserving a clear ownership boundary between users and events.

The quotation model is named `Quotation` in Prisma. A `RateLimitBucket` table stores hashed login/registration keys and atomic attempt windows.

## Server-side actions
The current event mutations live in `lib/event-actions.ts`, with checks for:
- user authentication
- event existence
- matching owner ID
- input validation with Zod
- path revalidation after mutations

Implemented mutations are primarily create operations plus event deletion. Full edit/delete workflows for expenses, tasks, vendors, guests, quotations, and RSVP updates are not present. The impact page saves manual pending notes; it does not apply proposals.

## Build and deployment notes
- Local development uses SQLite for easy setup.
- Run `npm run db:migrate` and `npm run db:generate` after setup. Deployments use `npm run db:deploy`.
- The login/registration limiter is atomic only for clients sharing the same persistent database. The local SQLite configuration is for a single instance, not horizontal scaling.
- Monetary columns still use SQLite `REAL`/Prisma `Float`; exact minor-unit storage requires a future data migration.
- Production builds are validated with `npm run build`.
- User-specific routes render on demand and are protected by page-level authentication/ownership checks.
