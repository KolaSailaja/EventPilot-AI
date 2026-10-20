# Security and Privacy

## Authentication
The app uses NextAuth credentials-based authentication. Credentials are validated with Zod and password comparisons using `bcryptjs`. Registration rejects oversized bodies and cross-origin Origin headers. Sessions are JWT-backed with a seven-day maximum age. Registration/login throttling is persisted through atomic database upserts.

## Server-side authorization
Authorization is enforced in server actions and page logic, not in the browser. Event mutations require an authenticated user and event-owner match. Current event read pages return not-found for non-owners. Automated integration tests cover all existing event reads and writes, plus cross-event budget-category attachment.

## Data protection
- No event mutation is trusted from browser state.
- Event access is bound to the authenticated user's ID.
- Secret configuration is stored in ignored environment files or deployment configuration; `.env.example` contains placeholders.
- User-supplied content is rendered as escaped React text; no raw HTML insertion was found.

## Input validation
Zod validation is used for user creation, login, and event-related operations to reduce malformed payloads and injection risks.

## Privacy assumptions
- The app is intentionally designed for single-user event ownership.
- Shared access is not implemented beyond the direct owner model.
- Data is kept in the local project database for development use.
- The local SQLite setup is single-instance. Rate-limit counters are shared only when instances connect to the same persistent database.
- IP-based throttling relies on trusted reverse-proxy forwarding headers.
- Duplicate registration responses can reveal whether an email exists; accounts are not verified by email.

## Hardening recommendations
- Migrate floating-point money columns to exact integer minor units using a reviewed data migration.
- Add email verification and account-recovery workflows.
- Add auditing and activity logs for destructive operations.
- Select a shared production database and configure trusted proxy headers and secret management.
- Consider adding collaborative invites and fine-grained permission models in future versions.

This audit is not a security certification or guarantee. Browser-level testing, production hosting configuration, dependency updates, and the incomplete workflows listed in `AUDIT_REPORT.md` remain outstanding.
