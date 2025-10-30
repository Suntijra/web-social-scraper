# Repository Guidelines

## Project Structure & Module Organization

- `src/` holds the Hono API; `server.ts` starts the listener, `app.ts` registers routes, and `factory.ts` shares validated env vars.
- Domain-specific logic sits in `src/features/`, shared utilities in `src/libs/`, cross-cutting hooks in `src/middlewares/`, and runtime contracts in `src/schemas/` + `src/types/`.
- Browser automation scripts live in `facebook/` (Playwright runner, cleaners, Ollama client). Keep them decoupled from the API by exporting typed entry points only.
- Local TLS keys are loaded from `.credentials/localhost*.pem`; generate them locally and keep them out of version control.

## Build, Test, and Development Commands

- `bun install` – install and lock dependencies (use Bun; `npm install` will ignore `bun.lock`).
- `bun run dev` – start the HTTPS dev server with live reload (`tsx watch -r dotenv/config src/server.ts`).
- `bun run lint` / `bun run lint:fix` – lint TypeScript sources; the fix variant applies safe autofixes.
- `bun run check-format` / `bun run format` – validate or rewrite formatting via Prettier.
- `bun run facebook/playwrightRunner.ts` – execute the Playwright scraper end-to-end; export `FACEBOOK_*` secrets via `.env.local` before running.

## Coding Style & Naming Conventions

- TypeScript only; use `camelCase` for values, `PascalCase` for types and modules, and `SCREAMING_SNAKE_CASE` for env keys.
- Prettier enforces two-space indentation, single quotes, trailing commas; run `bun run format` before committing.
- ESLint (`eslint.config.mjs`) bans `any`, enforces ordered imports, and warns on unused imports; rely on the `#` alias (`#libs/logger`) instead of relative chains.
- Route logs through `#libs/logger` (Pino) rather than `console.log`.

## Testing Guidelines

- Automated tests are not yet present; add colocated specs under `src/features/<feature>/__tests__/` using Bun’s test runner or Vitest.
- Mirror the Zod schemas when asserting success and error responses. Exercise scraping flows through the Playwright runner and store fixtures in `facebook/__fixtures__/` (create as needed).
- Keep tests deterministic by mocking outbound HTTP and injecting fake dependencies.

## Commit & Pull Request Guidelines

- Follow the concise, present-tense commit style already in history. Keep summaries ≤50 characters and add a scope prefix when it clarifies the change (`features: guard facebook scraper`).
- Each PR must explain intent, note verification (`bun run lint`, targeted scraper run), and link issues. Include screenshots or logs when altering scraping behaviour.
- Husky runs lint-staged on commit; stage only well-formatted files to avoid hook failures.
