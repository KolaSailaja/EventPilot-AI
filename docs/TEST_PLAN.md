# Test Plan

## Executed automated coverage

`npm test` runs Vitest unit tests and integration tests against a disposable SQLite database. The integration test creates synthetic users and deletes its temporary database; it does not use the `.env` database.

Covered cases include:
- registration normalization, invalid and duplicate input, concurrent duplicate registration, cross-origin rejection, and oversized form bodies
- valid/invalid credential checks and password-byte limits
- concurrent persistent rate limiting
- event creation/default-category persistence and owner-only deletion/cascade behavior
- expense, task, guest/RSVP, vendor/quotation, planning-note, and manual review-note persistence
- transaction rollback when quote insertion fails
- cross-event category attachment rejection
- cross-user denial on all current event mutations and all event read pages
- budget rounding/aggregation and validation for invalid dates, currencies, guest counts, statuses, and money values

An additional live HTTP smoke check was executed against a temporary local database: registration → NextAuth credential login/session creation → dashboard access → logout → protected dashboard rejection. This is not a browser automation test.

## Not covered / not implemented
- Real browser signup/login/logout and cookie-expiry behavior.
- Full edit/delete/status workflows for expenses, tasks, vendors, quotations, guests, and RSVPs.
- Calculated impact proposal approval/rejection and stale-proposal handling.
- A real external AI provider or malformed-provider response.
- Screen-reader, contrast, responsive-browser, and keyboard-only accessibility validation.
- Actual browser print output or downloadable export files.

## Validation commands
```bash
npm test
npm run typecheck
npm run lint
npm run build
```

See the current evidence and limitations in [AUDIT_REPORT.md](./AUDIT_REPORT.md).
