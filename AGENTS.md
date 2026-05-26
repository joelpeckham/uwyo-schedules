<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Design system (uwyoschedule)

- **Source of truth:** `design-system/README.md` (voice, color, type, components, content rules) and `design-system/colors_and_type.css` (tokens).
- **Cursor skill:** `.cursor/skills/uwyoSchedules-design/SKILL.md` — invoke when building or reviewing on-brand UI, static mocks, or when mapping tokens into the Next.js app.
- **Brand assets in the app:** `public/brand/*.svg` (e.g. `/brand/logo-wordmark.svg`, `/brand/favicon.svg`); full tree also under `design-system/assets/`.
- **Prototypes:** `design-system/preview/` (HTML), `design-system/ui_kits/web/` (JSX + styles tied to the same tokens).

- **The running app’s theme** is `src/app/globals.css` (imports `design-system/tokens.css` and maps shadcn/radix variables). Do not add a second parallel palette in oklch without updating the design tokens.

For production, align Tailwind and `src/app/globals.css` with the token file rather than only linking the standalone `colors_and_type.css` sheet in isolation.

## CI before done

Do not consider implementation complete until local checks pass (see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

**Always run:**

```bash
pnpm ci:quality   # lint, typecheck, test:run, knip
```

**Also run when app routes, SSR, planner UI, or shared exports change** (requires `DATABASE_URL` in `.env.local`):

```bash
pnpm build
pnpm test:e2e
```

Cursor agents: follow `.cursor/rules/ci-before-done.mdc`. GitHub Actions e2e needs the `DATABASE_URL` repository secret (see `.env.example`).
