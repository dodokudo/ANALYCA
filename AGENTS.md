# Repository Guidelines

## Project Structure & Module Organization
- `app/` holds the Next.js App Router pages and route handlers; colocate page-specific components under their route folder.
- `components/` stores reusable UI pieces; prefer dedicated subfolders for complex widgets with a `index.tsx` entrypoint.
- `lib/` contains data utilities and API clients; share cross-route logic here rather than duplicating inside `app/`.
- `public/` keeps static assets (logos, fonts). Use relative paths (`/asset-name`) when referencing from React components.
- Sensitive scripts live in `credentials/`; never load them in client code.

## Build, Test, and Development Commands
- `npm run dev` — launch the Next.js dev server with Turbopack at http://localhost:3000.
- `npm run build` — produce an optimized production build; run before deploying or merging significant changes.
- `npm run start` — serve the production build locally to verify runtime behavior.
- `npm run lint` — execute ESLint with the Next.js config; fix issues before submitting a pull request.

## Coding Style & Naming Conventions
- TypeScript is mandatory; prefer explicit types on exported functions and props.
- Follow the project ESLint rules and the default Next.js/Prettier formatting (2-space indentation, single quotes allowed, trailing commas where valid).
- Use PascalCase for React components, camelCase for helpers, and SCREAMING_SNAKE_CASE for environment variables.
- Keep file names kebab-case (`charts-overview.tsx`) unless exporting a React component class.

## Testing Guidelines
- No automated test suite is configured yet; add Jest or Playwright tests alongside new features when practical.
- Name test files `*.test.ts` or `*.test.tsx` and group them near the code under a `__tests__/` directory to encourage locality.
- When adding data integrations, mock external services and validate error handling paths.

## Commit & Pull Request Guidelines
- Git history favors short, descriptive subject lines (present tense, <60 chars). Continue this convention and group related changes in a single commit when possible.
- PRs should outline the intent, highlight UI changes with screenshots or GIFs, and link to related tickets.
- State testing performed (commands run, manual checks). Flag any follow-up tasks or known limitations before requesting review.

## Security & Configuration Tips
- Store secrets in `.env.local`; never commit them. Provide `.env.example` updates when introducing new vars.
- For Google Cloud integrations, keep service account JSON files outside tracked paths or reference them via environment variables.
- Inspect dependencies touching OAuth or analytics and document required scopes in the PR description.
