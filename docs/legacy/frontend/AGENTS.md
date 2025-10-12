# Repository Guidelines

## Project Structure & Module Organization
- The `app/` directory holds App Router routes (`laundry`, `fridge`, `library`, `study`) with segment-specific `page.tsx` files; colocate new feature assets inside the relevant route folder.
- Reusable UI lives in `components/` (`ui` for primitives, `shared` for cross-route widgets, domain folders like `fridge/`); pair them with supporting hooks in `hooks/` and shared logic in `lib/`.
- Persist shared state via Zustand stores in `stores/`, keep global styles and Tailwind tokens in `styles/globals.css`, and store static assets plus PWA icons in `public/`.

## Build, Test, and Development Commands
- Install dependencies with `pnpm install` (the lockfile is pnpm-based).
- `pnpm dev` runs the Next.js dev server with hot reload, while `pnpm build` emits the production bundle and `pnpm start` serves it locally.
- `pnpm lint` executes the Next.js ESLint config; fix warnings before opening a pull request.

## Coding Style & Naming Conventions
- Stick to TypeScript with React function components, two-space indentation, and named exports for shared utilities.
- Favor Tailwind utility classes defined in `styles/globals.css`; extend the design system through the `@theme inline` block instead of ad-hoc hex values.
- Keep domain logic pure in `lib/` (camelCase helpers) and compose UI from small, reusable pieces; colocate Zustand stores alongside their feature folders when the surface grows.

## Testing Guidelines
- Automated tests are not yet wired; when adding them, prefer Vitest or Jest with React Testing Library and expose the runner as `pnpm test`.
- Name specs `<component>.test.tsx` next to the subject or under a `__tests__/` folder, and include accessibility assertions.
- Document manual verification for PWA flows (install prompts, offline cache) in PR descriptions until automated coverage is available.

## Commit & Pull Request Guidelines
- Write commits in the imperative mood with a concise scope (e.g., `fix: restore fridge stock polling`); squash trivial WIP before review.
- PRs should explain the problem, highlight the solution, list new routes or env vars, and attach screenshots or GIFs for UI changes.
- Note what was linted or manually tested, and link tracking issues or product specs when available.

## PWA & Deployment Notes
- Update `app/manifest.ts` and `public/icon.png` for branding changes; keep icons square and at least 512px.
- Validate service-worker behaviour with Chrome Lighthouse before releases, and ensure `next.config.mjs` settings align with the target hosting provider.
