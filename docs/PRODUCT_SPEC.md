# EventPilot AI Product Specification

## Product summary
EventPilot AI is a planning workspace for event organizers who need to manage logistics, budgets, vendor coordination, guest communication, and decision-making in one place. The product is designed for weddings, corporate events, celebrations, and milestone gatherings where timelines, spending, and attendee experience matter.

This document describes the intended product. It is not a claim that every feature below is implemented; current implementation status is tracked in [AUDIT_REPORT.md](./AUDIT_REPORT.md).

## Primary goals
- Keep planning organized and collaborative in a single dashboard.
- Surface budget health and spending gaps before surprises happen.
- Turn planning tasks into a structured review workflow.
- Support AI-assisted planning suggestions without forcing hidden changes.
- Protect event data with ownership checks and secure server-side operations.

## Core user flows
### 1. Signup and onboarding
- User creates an account with email and password.
- New account is stored in the database and session is created.
- User lands on the dashboard and can create a first event.

### 2. Create an event
- User enters event name, type, date, location, and budget.
- Event is saved with an owner reference to the authenticated user.
- Event opens into a dedicated workspace.

### 3. Manage the event workspace
Users can navigate to sections for:
- overview
- budget
- tasks
- vendors
- guests
- AI planning
- impact review
- export

### 4. Budget overview
The app tracks:
- planned budget
- actual spending
- remaining balance
- expense categories and outliers

### 5. AI planning and review
Target behavior: a provider-backed planning assistant generates structured recommendations with a human review layer before applying changes. The current application only creates deterministic starter notes; it has no LLM integration or proposal-approval workflow.

### 6. Ownership and permissions
Each event is owned by one user. All writes and sensitive reads require the authenticated user to match the owner.

## Non-functional goals
- Secure server-side validation of all mutation requests.
- Deterministic logic for budget calculations and event data integrity.
- Good UX with clear navigation and actionable cards.
- Production-ready architecture with database-backed persistence.

## Success metrics
- Users can sign up and create an event in under 2 minutes.
- Budget and task workflows are easy to review at a glance.
- Ownership enforcement prevents cross-user access.
- Build and validation flow remain stable in CI and local production checks.

These are goals; product analytics and usability measurements have not been collected.
