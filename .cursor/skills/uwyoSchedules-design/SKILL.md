---
name: uwyoschedules-design
description: >-
  On-brand UI and content for uwyoSchedules. Use for interfaces, static mocks,
  HTML previews, and production Next.js. Covers tokens (colors_and_type.css),
  voice, Lucide, logos, and the web UI kit under design-system/.
user-invocable: true
---

# uwyoSchedules design system

**Canonical content lives in the repository at** `design-system/`. This skill is a short pointer; read the full spec there before shipping visuals or copy.

## Where to look

| Resource | Path |
|----------|------|
| Brand, voice, foundations | `design-system/README.md` |
| Design tokens (CSS variables, light + dark) | `design-system/tokens.css` (and `colors_and_type.css` for static element defaults) |
| Logos, topo divider (source) | `design-system/assets/` |
| Same assets for Next.js URLs | `public/brand/*.svg` (e.g. `/brand/favicon.svg`) |
| HTML token/component previews | `design-system/preview/` |
| React/JSX UI kit (prototype) | `design-system/ui_kits/web/` |

## For agents

1. **Production Next.js:** `src/app/globals.css` imports `design-system/tokens.css` and maps shadcn variables; use `design-system/tokens.css` and `README.md` as the source of truth, not a separate oklch template. Icons: the app uses `lucide-react` (not the Lucide CDN script from the static previews).
2. **Static HTML or throwaway mocks:** Link `design-system/colors_and_type.css` and follow the patterns in `design-system/preview/`.
3. **Copy and tone:** Sentence case, no emoji in product UI, no exclamation points in microcopy, Wyoming-aware but not corny. Full rules in `design-system/README.md` (CONTENT FUNDAMENTALS, VISUAL FOUNDATIONS).

## Quick reference

- **Brand:** Calm, editorial, cream paper, rust primary, sage secondary, serif display + sans UI + mono for codes/times.
- **Substitutions (until licensed fonts exist):** Source Serif 4, Inter, JetBrains Mono — see README.
- If the user opens this skill without a task, ask what they are building and whether the output is production code or a static mock.

## Related project docs

- `AGENTS.md` — how AI assistants should work in this repo (Next.js 16, design system pointer).
