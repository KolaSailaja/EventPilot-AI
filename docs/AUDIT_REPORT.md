# EventPilot AI Functional and Security Audit

## Scope and evidence

Reviewed the existing repository and worktree without resetting or replacing user files. Inspected authentication, registration, server actions, every event page, Prisma schema/migrations, validation, export, current tests, dependencies, README, environment-file ignore rules, and the installed Next.js 16 server-action/data-security/proxy guidance.

Automated evidence is from:

- `npm test` — 37 unit/integration tests passed against an isolated SQLite database.
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npx prisma generate`
- `npx prisma migrate deploy --schema prisma/schema.prisma` against a disposable SQLite database; all three checked-in migrations applied.
- `npm audit` and `npm audit --omit=dev`

A live HTTP smoke test on a disposable database also passed registration, NextAuth credential login/session creation, dashboard access, logout, and post-logout access denial.

Integration tests use temporary SQLite files and synthetic accounts/events, not the `.env` database. The rate-limit migration was also applied to the configured local database after its SQL was verified; that migration only creates the new limiter table/index and does not rewrite user or event records. Fresh checkouts must still apply migrations before running the app.

## Findings and current status

### Authentication, registration, sessions

- **Working and verified:** Registration normalizes email, hashes passwords with bcrypt, persists accounts, rejects malformed/duplicate values, handles duplicate-email races, rejects over-size request bodies and cross-origin browser requests. Tests also exercise correct, incorrect, overlong-byte credentials and the password-hash-backed user lookup.
- **Working and verified:** Login throttling uses an atomic SQLite upsert, stored in a migration-backed table; 20 simultaneous attempts against a limit of 5 admitted exactly 5. Counters hash submitted identity/IP keys rather than storing them in clear text.
- **Working and verified by source inspection:** The account page invokes NextAuth `signOut`; protected pages check the authenticated session, and the session lifetime is explicitly seven days.
- **Working and verified (local HTTP smoke):** Registration → NextAuth CSRF token and credential login → session-cookie issuance → protected dashboard → sign-out → session invalidation and dashboard denial all passed against a disposable database.
- **Partially implemented / not verified:** JWT maximum age is configured to seven days, but actual expiry after elapsed time was not tested. No browser automation or production proxy is used in the smoke test.
- **Residual risk:** IP throttling depends on `x-forwarded-for`/`x-real-ip`; those headers must be overwritten by a trusted reverse proxy. The local SQLite file is suitable only for a shared single-instance deployment. Multiple hosts need the same supported shared database; separate local files do not provide cross-instance limits.
- **Residual privacy risk:** Duplicate registration returns HTTP 409, which allows email-existence probing. Accounts are not email-verified, and no recovery workflow exists.

### Ownership, privacy, and server operations

- **Working and verified:** Automated tests prove a different authenticated user cannot create expenses, tasks, guests, vendors/quotes, planning notes, or proposal notes for an event, nor delete it. Database state remains unchanged after denied writes.
- **Working and verified:** All eight event read pages (overview, budget, tasks, vendors, guests, planning, impact notes, export) return not-found for another user's event in integration tests.
- **Working and verified:** Expense categories are checked against the target event, preventing a category from another event being attached. The app has no arbitrary vendor-ID, guest-ID, RSVP-ID, or quotation-ID mutation actions that could be exercised cross-event.
- **Working and verified by source inspection:** Server Actions are treated as public POST entry points and perform their own authentication/ownership checks. Next.js server-action Origin checks remain enabled; the registration Route Handler also rejects mismatched supplied Origin headers. React renders user/plan text as text; no `dangerouslySetInnerHTML` or unsafe raw HTML rendering was found.
- **Partially implemented:** Error behavior is safe for authorization failures and registration parsing, but many mutation errors are thrown to Next.js rather than presented as field-level form feedback.
- **Residual risk:** Proxy/IP header trust and duplicate-account enumeration remain as above. A full deployed reverse-proxy/CSRF configuration has not been exercised.

### Database, persistence, and transactions

- **Working and verified:** Prisma 5.22.0 client generation succeeded. Both the initial schema migration and the rate-limit-table migration applied successfully to a disposable SQLite database. Existing relations use cascades for owned event records.
- **Working and verified:** Event creation writes its default budget categories together with the event. Guest/RSVP and vendor/quotation creation use transactions. A database trigger deliberately failed quotation creation in a test, and the vendor insert rolled back.
- **Working and verified:** The rate-limit migration is checked in and the migration workflow is documented in the README.
- **Partially implemented:** The existing `.env` database was deliberately not migrated during this audit to avoid altering user data. Run `npm run db:migrate` locally or `npm run db:deploy` in deployment before using the new limiter table.
- **Residual high-priority financial risk:** Event budget, category allocations, expenses, and quotes remain Prisma `Float`/SQLite `REAL` columns. Input values are bounded and application calculations round consistently, but stored floating-point values are not an exact financial representation. Migrating existing data to integer minor units requires an explicit data migration and remains incomplete.

### Budget and quotations

- **Working and verified:** Budget summaries distinguish planned expenses from actual spend; planned entries no longer inflate spent/remaining totals on overview, dashboard, budget, and print views. Tests cover aggregation and half-cent rounding.
- **Working and verified:** Invalid, non-finite, negative, overlarge amounts, unsupported currencies, invalid dates, fractional guest counts, invalid task values, and event/category mismatches are rejected by validation or integration tests.
- **Working and verified:** An unpriced vendor is saved without a misleading zero-value quotation.
- **Partially implemented:** Quotes are stored separately from expenses. Confirmed quotes are not added to actual spend, and there is no unified quotation-to-expense conversion or category allocation editor.
- **Missing:** Expense edit/delete, category CRUD, vendor/quotation edit/delete, quote confirmation changes, and budget-change review flows.

### Tasks and timeline

- **Working and verified:** Task creation persists validated titles, priorities, status defaults, and valid calendar due dates.
- **Missing:** Task editing, deletion, and status/priority updates. Task dependency support is also absent from the schema and UI; it is not represented as an implemented feature.

### Vendors, guests, and RSVP

- **Working and verified:** Vendor creation and optional quotation creation persist; paired writes roll back atomically on a forced database failure. Guest creation and initial pending RSVP are written in one transaction.
- **Missing:** Vendor/quotation updates or deletion; guest updates/deletion; RSVP response/status updates. Current guest counts are based on records, not confirmed/attending headcount.

### Planning notes and Change Proposal/Impact Engine

- **Working and verified:** The budget generator calls the OpenAI Chat Completions API only when `OPENAI_API_KEY` is set. Saved-event prompts are built server-side from persisted event details, constraints, allocations, expenses, open tasks, RSVP counts, and vendor quote amounts. New-event prompts include the organizer's submitted brief. Provider output is schema-validated and rounded before it is returned; missing configuration, timeouts, rate limits, HTTP failures, and malformed output have explicit errors.
- **Working and verified:** The Vision-to-plan Studio is deterministic, not LLM-powered. It now includes saved event context, menu and accessibility inputs, open tasks, pending RSVP counts, and vendor follow-ups in stored planning notes. It does not claim live pricing, external research, or vendor availability.
- **Working and verified:** The What-If simulator previews budget and guest-count changes using deterministic arithmetic. A saved scenario contains a validated structured payload and baseline, and the user can explicitly approve/apply or reject it. Applying updates only the event budget target and guest count in a transaction; expenses, quotations, and category allocations are left untouched. A conditional update prevents application when the budget or guest count changed since the proposal was created; stale proposals are marked stale.
- **Partially implemented:** Scenario proposals do not modify task timelines, vendor quotes, or allocations; there is no generative conversational assistant. Planning notes and provider estimates remain guidance and require organizer verification.

### Export

- **Working and verified:** The owner-protected printable summary now has a functioning browser print/save-PDF button and includes event details, guest names/RSVP display, tasks, vendors/quotes, and expense entries. Event read-page ownership tests include export.
- **Partially implemented:** This is browser printing, not a downloadable CSV/PDF export. Browser print output itself was not tested in a real browser.

### Accessibility and UI behavior

- **Working and verified by source inspection:** Sign-in/sign-up/event-creation forms have labels; inline forms gained accessible names; field errors use an alert role; focus-visible indicators are applied globally. The print button is functional rather than decorative.
- **Partially implemented / not verified:** No screen-reader, keyboard-only, contrast-measurement, responsive-browser, or automated accessibility suite was run. Some server-action validation failures still lack inline feedback.

### Dependencies and secrets

- **Working and verified:** `.env*` is ignored by Git, the checked-in environment template contains placeholders, and a source scan found no common API-key/private-key patterns. The local secret was confirmed to be present and non-placeholder without printing its value.
- **Dependency audit:** `npm audit --omit=dev` reports zero vulnerabilities. Full `npm audit` reports 5 HIGH paths, all originating from one advisory in `braces@3.0.3`, reached through `micromatch` → `fast-glob` → `@next/eslint-plugin-next` → dev-only `eslint-config-next`. The affected pattern can cause stack-exhaustion denial of service when a deeply nested pattern is processed; the affected packages are development/lint tooling, not production dependencies. It can still affect developer/CI runs if an attacker can introduce a malicious pattern into the checked-out project.
- **Remediation decision:** The npm registry reports `braces` latest as 3.0.3; `braces@3.0.4` does not exist. `npm audit fix --force` proposes downgrading `eslint-config-next` to incompatible 14.2.35. No override or blind framework downgrade was applied. Recheck the advisory and update the compatible upstream dependency when a safe patched release is available.

## Automated test coverage

The test suite now includes:

- budget summary aggregation, rounding, and invalid-money cases
- AI budget provider missing-key, timeout, rate-limit, malformed-output, context, and validated-output cases
- persisted event-context inclusion in saved-event budget requests
- What-If proposal validation, calculated impact, explicit approval/application, rejection, stale-state protection, and owner-authorization cases
- deterministic planning-note coverage for menu/accessibility recommendations, open tasks, and RSVP follow-up
- event/task validation including impossible dates and currency/guest-count bounds
- event creation and default-category persistence
- expense/task/guest+RSVP/vendor+quote/planning-note/proposal-note persistence
- cross-event budget-category rejection
- forced transaction rollback
- successful event deletion and cascade behavior
- cross-user denial for every current event mutation
- cross-user denial on all eight event read pages
- registration success, normalization, invalid input, duplicate race, body-size limit, and cross-origin rejection
- valid/invalid credential checks and concurrent database rate-limit enforcement

These are isolated unit/integration tests, not browser-based end-to-end tests. The current app still lacks several workflows listed above, so those cannot be reported as tested.

## Highest-priority remaining work

1. Move financial values to integer minor units (or another exact representation) with a reviewed data migration.
2. Implement event, expense, task, vendor/quote, guest, and RSVP update/delete operations and test them with owner-isolation coverage.
3. Expand structured scenarios if product scope later requires changes to allocations or other event records; those fields are deliberately not changed by the current approval workflow.
4. Add browser-based signup/login/logout and primary workflow tests once a browser E2E runner is deliberately selected.
5. Deploy behind a trusted proxy and a shared supported database; verify rate-limit and origin behavior in that environment.
6. Recheck the dev-tool dependency advisory when a compatible patch is published.
