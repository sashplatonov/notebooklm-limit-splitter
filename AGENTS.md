<!-- Inherits global rules from /Users/sash/.ai-rules/AGENTS.md -->
# Repository Guidelines

## Project Structure & Module Organization
- `src/App.tsx` owns the single-page workflow for file intake, processing state, and export actions.
- `src/components/` contains presentational UI blocks such as the drop zone, settings panel, and result cards.
- `src/utils/` holds pure processing helpers for splitting, file normalization, and ZIP generation.
- `src/types.ts` defines shared TypeScript contracts used across the app.
- `vite.config.ts` contains the frontend build contract, and container assets live in `Dockerfile`, `docker-compose.yml`, `.dockerignore`, and `nginx.conf`.

## Build, Test, and Development Commands
- `npm ci` installs the exact frontend dependency set from `package-lock.json`.
- `npm run dev` starts the Vite development server for local UI work.
- `npm run build` produces the production bundle in `dist/`.
- `npm run preview -- --host 0.0.0.0 --port 4173` serves the built app for local smoke testing.
- `docker build -t notebooklm-file-splitter-tool .` builds the production container image.
- `docker compose up --build` builds and runs the local containerized stack without publishing ports to the host.

## Coding Style & Naming Conventions
- Use TypeScript with ES modules, React function components, and explicit prop interfaces.
- Keep utility code side-effect free where possible and prefer descriptive `camelCase` names for functions and variables.
- Use `PascalCase` for React components and colocate small UI-only concerns inside `src/components/`.
- Keep comments sparse and only explain non-obvious logic or runtime constraints.

## Testing Guidelines
- For infrastructure-only changes, the minimum gate is `npm run build`, `docker build`, and `docker compose config`.
- For UI or logic changes, add the same build checks and verify the affected flow in the browser before closing the task.
- Do not suppress build or runtime warnings; fix the root cause instead.

## Commit & Pull Request Guidelines
- Use Conventional Commits such as `build: Add production Docker stack`.
- Keep the subject imperative, capitalized, and under 50 characters.
- PRs should include the user-visible impact, verification commands run, and any runtime assumptions such as internal-only container ports or external reverse-proxy requirements.
