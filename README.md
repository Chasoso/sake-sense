# sake-sense

## Development

This repository uses a hypothesis-driven, local-first development loop:

`Hypothesize -> Specify -> Build -> Verify -> Experience -> Learn`

Read [AGENTS.md](AGENTS.md) before starting work. The [development loop](docs/development/development-loop.md) explains the execution lifecycle, and the [Issue authoring guide](docs/development/issue-authoring-guide.md) describes how to write implementation-ready Issues.

### Local setup

Supported versions are Node.js 22.12 or newer and npm 10 or newer.

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite. Run `npm run build` for a production build and `npm run typecheck` for strict TypeScript validation.

The current structure and intentionally deferred decisions are documented in [the architecture notes](docs/architecture/README.md). Local startup has no AWS, backend, authentication, database, or external service dependency.
