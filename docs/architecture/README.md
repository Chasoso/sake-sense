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

## Production semantic bridge

Issue #33 adds an explicitly configured production adapter without changing the provider-neutral domain contract:

```text
Browser-derived SensoryBridgeInput + mapped dictionary context
  -> API Gateway HTTP API
  -> packaged Lambda request/output validation
  -> Bedrock Converse structured output
  -> browser validator
  -> curated dictionary and provenance-backed product matching
```

Raw camera, audio, image, landmark, and pose-history data remain local. The AI path is selected only when `VITE_SENSORY_BRIDGE_API_URL` is present; local development and CI use the deterministic fixture by default. See [the production AI deployment guide](../deployment/aws-ai-semantic-bridge.md).

## Intentionally deferred

The Body path is `camera -> local MediaPipe -> derived Body features -> backend`. The Voice path is `microphone -> local feature extraction -> derived Voice features -> backend`. Authentication, databases, raw multimodal input, speech-to-text, recommendation ranking, and persistent user history remain out of scope for the production semantic bridge MVP.
