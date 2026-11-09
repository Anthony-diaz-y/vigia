# Taste

## Tooling / Stack
- Prefers his own working stack for projects: Next.js, NestJS, TypeScript, Tailwind, PostgreSQL, TypeORM — wants projects migrated toward it, while leaving room for the assistant to recommend keeping another language where it is genuinely better justified. Confidence: 0.85

## Workflow
- Expects migrations/refactors to be done cleanly and professionally without breaking any existing functionality (preserve behavior, not just get it compiling). Confidence: 0.6
- Wants substantial feature/migration work developed on a dedicated branch (e.g. a migration branch) rather than directly on the main line. Confidence: 0.6
- Prefers a lean repository: once something is superseded (legacy dashboards, old prototypes, tool caches, generated artifacts), delete it instead of leaving it around — keep only what the current goal actually needs. Also expects duplicated implementations of the same thing to be consolidated/removed rather than kept side by side; will push back if a cleanup pass still leaves many folders behind, and will follow up asking for remaining top-level folders (docs, docker, packages, config) to be audited for removal. Confidence: 0.85
