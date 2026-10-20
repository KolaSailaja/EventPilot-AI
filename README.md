# EventPilot AI

EventPilot AI is an event-planning MVP built with Next.js App Router, TypeScript, Prisma, SQLite, and NextAuth credentials authentication. It provides account registration, private event workspaces, budget entries, task creation, vendor/quotation creation, guest/RSVP creation, deterministic planning notes, and a printable event summary.

## Requirements

- Node.js 22 or a version supported by the installed Next.js release
- npm

## Local setup

1. Install dependencies:

   ```powershell
   npm ci
   ```

2. Create a local environment file and replace the placeholder secret:

   ```powershell
   Copy-Item .env.example .env
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
   ```

   Put the generated value in `AUTH_SECRET`. Keep `.env` private and do not commit it. `DATABASE_URL` defaults to a local SQLite file.

3. Apply the checked-in database migrations and generate the Prisma client:

   ```powershell
   npm run db:migrate
   npm run db:generate
   ```

4. Start the development server:

   ```powershell
   npm run dev
   ```

   Open <http://localhost:3000>.

For a deployed environment, configure `DATABASE_URL`, `AUTH_SECRET`, and `NEXTAUTH_URL` in the hosting platform. Run `npm ci`, `npm run db:generate`, and `npm run db:deploy` during deployment. The default SQLite setup is intended for local/single-instance use. Horizontal scaling requires switching/migrating the schema to a shared database supported by Prisma and ensuring every instance uses that same database for persisted rate-limit counters.

## Validation

```powershell
npm test
npm run lint
npm run typecheck
npm run build
```

`npm test` runs unit tests and database integration tests. Integration tests create an isolated temporary SQLite database, use synthetic accounts/events, and remove the test database afterward; they do not connect to the `.env` database.

## Current implementation limits

- AI Studio output is deterministic application-generated planning text, not a Gemini or other LLM integration.
- Impact entries are pending manual review notes. There is no calculated proposal payload, approval/rejection, stale-proposal detection, or application of proposed changes.
- Event, expense, task, vendor/quotation, guest, and RSVP flows currently create records; full edit/delete/status-update workflows are not implemented (event deletion is available).
- Vendor quotations are stored separately from expenses and are not automatically included in actual spend or budget totals.
- The export screen is an owner-protected printable summary. It does not generate a downloadable file.
- Monetary columns in the current SQLite schema use floating-point storage. Input validation and display calculations round to two decimal places, but this is not a substitute for an integer-minor-unit or decimal-storage migration.
- Registration and login rate-limit counters use atomic database operations. They are shared only by instances connected to the same database; the default local SQLite configuration is not a distributed multi-host limiter. Forwarded client-IP headers must be set by a trusted reverse proxy.

See [docs/AUDIT_REPORT.md](./docs/AUDIT_REPORT.md) for verified behavior, remaining risks, and test evidence.
