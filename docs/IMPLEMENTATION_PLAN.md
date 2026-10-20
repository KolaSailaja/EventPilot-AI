# Implementation Plan

## Completed foundation
- Next.js App Router, TypeScript, styling, and environment templates are present.
- Prisma schema and SQLite migrations are present.
- Credentials authentication, registration, and rate limiting are implemented and integration-tested.

## Partially implemented event domain
- Event creation, dashboard, and event workspaces are present.
- Create flows exist for expenses, tasks, guests/initial RSVP, vendors/optional quotations, deterministic planning notes, and manual review notes.
- Full edit/update/delete flows are missing for most related records.

## Completed baseline hardening; residual work remains
- Owner checks are tested for current event mutations and read pages.
- Inputs, request sizes, Origin, transaction boundaries, and database-backed throttling are validated.
- Exact monetary storage, email verification, recovery, deployment proxy configuration, and browser testing remain.

## Validation status
- Unit/integration tests, lint, typecheck, production build, migration deployment on a disposable database, and a live HTTP auth flow are run; see [AUDIT_REPORT.md](./AUDIT_REPORT.md).

## Remaining implementation priorities
- Replace `Float` money storage with integer minor units using a safe migration.
- Implement CRUD/status updates for event-related records.
- Implement deterministic impact calculations, stale checks, and atomic approval/rejection.
- Add a real AI provider only with server-side key handling and validated outputs.
- Add browser E2E and accessibility coverage.
- Add collaboration only after a permission model is designed.
