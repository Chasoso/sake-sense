# Architecture

## Current shape

The local application is intentionally small:

- `src/domain/` contains pure domain types and logic. It does not import React, browser APIs, cloud SDKs, or generative-AI SDKs.
- `src/features/` contains UI-facing experiments and components.
- `src/app/` composes the application and connects domain output to features.
- `src/infrastructure/` is reserved for explicit adapters to external APIs or storage.

`src/main.tsx` is the browser entry point. Browser-only concerns stay at this edge, while the current domain module can be exercised without a browser.

## Local-first decision

Local UX experimentation must not depend on AWS or another external service. The current shell has no backend, authentication, persistent storage, or network dependency, so `npm run dev` is sufficient to start the project.

## Intentionally deferred

This foundation does not decide the final Sake Sense UX, product translation logic, sensory vocabulary, gesture or audio interaction, backend API, authentication, database, generative AI integration, AWS architecture, or deployment approach. Those decisions belong in future Issues and hypotheses.
