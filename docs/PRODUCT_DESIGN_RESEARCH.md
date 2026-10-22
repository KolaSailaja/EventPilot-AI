# EventPilot AI product design research

## Research sources

- The Knot — wedding planning app: https://www.theknot.com/wedding-planning-app
- The Knot — wedding checklist: https://www.theknot.com/wedding-checklist
- Cvent trend report: https://www.cvent.com/en/blog/events/top-event-trends
- Cvent Attendee Hub: https://www.cvent.com/en/event-marketing-management/attendee-hub
- Bizzabo event website design guidance: https://www.bizzabo.com/blog/beautiful-event-websites-design
- Official Next.js App Router and styling guidance in the installed local package (`node_modules/next/dist/...`)

## Findings

### 1. Product expectations in the market

The Knot and similar planning products prioritize clarity, vendor discovery, checklists, and emotional reassurance. They are strong at reducing overwhelm, especially for weddings. Their experience is highly structured and often event-type-specific, but they tend to focus on planning journeys rather than complete event operations and scenario trade-offs.

Cvent and Bizzabo emphasize mobile-friendly event experiences, accessible interfaces, clear calls to action, and website design that feels immersive without becoming cluttered. Their guidance reinforces the importance of task clarity, simple hierarchy, and well-scoped interactions.

### 2. Product gaps we can own

EventPilot AI already has a useful operational foundation: event records, budget validation, vendor and guest flows, planning sections, and review notes. The opportunity is not to copy wedding-portal UI patterns. It is to turn this into a premium event command center for multiple event types, with a strong editorial aesthetic and human-centered planning logic.

The product can differentiate by combining:

- a premium, not generic, visual identity
- deterministic budget and scenario planning
- explicit review gates before change application
- event-type flexibility beyond weddings alone
- transparent AI-generated suggestions that remain clearly labeled

### 3. Design direction chosen

EventPilot AI should feel like a calm, premium planning workspace rather than a generic SaaS dashboard. The visual direction uses warm ivory surfaces, forest-green accents, and restrained gold highlights. This supports the positioning: “From event inspiration to a plan that actually works.”

The application should feel premium through: 

- layered cards and clear information hierarchy
- calmer spacing and stronger typography
- more confident calls-to-action
- clearly separated operational states from AI guidance
- scenario previews that can be reviewed before an event is changed

### 4. What we did in this pass

We redesigned the public marketing page and the app shell to feel more intentional and premium, with a stronger visual identity and clearer hierarchy. We also added a scenario-planning summary directly on the event overview so the user can preview budget and guest changes before applying any actual event change.

### 5. Limitations and constraints

- Web research here is limited to public marketing content and documentation; it does not replace a dedicated, product-led user research program.
- The repository currently does not include a production AI provider integration or a dedicated browser E2E suite, so the premium experience is best treated as a strong front-end and workflow redesign rather than a full AI product rollout.
- Competitor features like vendor marketplaces, guest communication systems, or live production logistics remain outside the current app scope and were not invented as claims for this build.

## Final product position

EventPilot AI should be positioned as an event-planning system that helps organizers move from an idea to a workable plan with strong budget clarity, reviewable changes, and elegant operational tooling — without pretending to have live operational integrations or confirmed vendor inventory that the current app does not actually have.
