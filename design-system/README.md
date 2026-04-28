# uwyoschedule — Design System

**Tagline:** _From course list to class schedule._

uwyoschedule helps UW students turn a course list into a weekly schedule that works, without the back-and-forth of juggling WyoWeb registration screens. The product is calm, focused, and locally rooted. It feels like Wyoming.

This design system is the canonical source of truth for the brand's visual and content language: typography, color, components, tone, and the assets needed to ship anything from a marketing page to an in-app modal.

---

## Sources & inputs

No codebase, Figma, or screenshots were attached at creation time. The system was built from:

- The product description: _"uwyoschedule: We make finding a schedule for your University of Wyoming classes fast, easy, and automatic."_
- Stylistic direction: **warm earthly color palette, serif fonts, shadcn/ui base components, Claude/Anthropic-inspired editorial calm**.
- Regional context: University of Wyoming sits in Laramie, WY — high plains, sagebrush, sandstone, and big sky. The palette pulls from that landscape rather than UW's official brown-and-gold athletic colors (we keep brown as the primary anchor but read warmer and more refined).

If a real codebase or Figma file becomes available, the next iteration should:
1. Replace the substituted Google Fonts with the real type stack.
2. Cross-check spacing, radii, and component shapes against the live product.
3. Pull real product copy into `Tone & Voice` examples.

---

## Index

| File / folder | What's in it |
|---|---|
| `README.md` | This file — context, voice, visual foundations, iconography. |
| `tokens.css` | Design tokens only (palette, semantics, type scale, space, radii, motion) + `.dark` / `[data-theme="dark"]`. Imported by the Next app and by `colors_and_type.css`. |
| `colors_and_type.css` | `@import` of `tokens.css` plus optional semantic element defaults for static HTML. |
| `.cursor/skills/uwyoSchedules-design/SKILL.md` (repo root) | Cursor agent skill: short pointer to this folder and how to use tokens in apps vs static HTML. |
| `assets/` | Logos, marks, and any iconography or imagery. |
| `../public/brand/` | Copies of `assets/*.svg` served by Next.js (e.g. `/brand/favicon.svg`). |
| `fonts/` | Web font files (currently empty — uses Google Fonts CDN, see _Type substitutions_). |
| `preview/` | HTML cards rendering each token / component group for the Design System tab. |
| `ui_kits/web/` | High-fidelity React/JSX recreation of the uwyoschedule web app. |

---

## CONTENT FUNDAMENTALS

The voice is **warm, plainspoken, and quietly confident** — like a friend who has already figured out registration and is happy to walk you through it. We are explicitly _not_ peppy, not "rocket-emoji" startup-y, and not bureaucratic-University.

### Tone pillars

1. **Calm authority.** We know how UW's catalog works. We don't oversell, we don't apologize.
2. **Plain words.** "Schedule," not "academic itinerary." "Classes," not "course offerings."
3. **You-first.** Address the reader directly. "Pick your classes" beats "students may select courses."
4. **Specific, not vague.** "12 schedules with no Friday classes" is better than "many great options."

### Casing & punctuation

- **Sentence case** for everything — buttons, headings, navigation. Title Case feels corporate.
  - ✓ "Build a schedule"
  - ✗ "Build A Schedule"
- **Oxford comma**, always.
- **Em dashes** with no surrounding spaces (editorial feel) — like this.
- **One space** after periods.
- **No exclamation points** in product UI. Save them for confetti moments (a successful registration).
- **Numerals** for everything ≥ 2 ("3 conflicts"), spelled-out for one ("one conflict left").

### Pronouns

- **"You"** for the user. Always.
- **"We"** for uwyoschedule itself, sparingly. Use mostly in onboarding, empty states, error explanations.
- **No "our team"** — feels stilted. Just "we."

### Emoji & decoration

- **No emoji in the UI.** Anywhere. (Exception: a single 🤠 may appear once on the 404 page or a celebratory toast — earned, not sprinkled.)
- **No exclamation marks, no "🎉," no "let's go."**
- Use **Unicode characters** for typographic polish: en-dashes (–) for ranges ("MWF, 9–10 a.m."), middle dot (·) as a separator, true curly quotes ("...").

### Specific copy examples

| Context | ✓ On brand | ✗ Off brand |
|---|---|---|
| Empty state | "No schedules yet. Add a class to start." | "Oops! Looks like you haven't added any classes yet 🎉" |
| Error | "We couldn't find that course. Check the subject code?" | "Error: Course not found." |
| CTA | "Build a schedule" | "Get Started Now →" |
| Loading | "Pulling courses from the catalog…" | "Loading..." |
| Success | "Saved. 4 schedules ready." | "Success! Your schedule has been saved." |
| Tagline | "From course list to class schedule." | "Revolutionizing UW registration!" |

### The Wyoming specificity

When it fits, lean into place. "Built in Laramie." "Made for UW students, by UW students." Don't force it — but don't run from it. The locality is part of the trust signal.

---

## VISUAL FOUNDATIONS

The system is **editorial, warm, and unhurried** — closer to a well-set magazine page than a SaaS dashboard. Lots of cream paper, generous serifs, restrained color, soft shadows.

### Color philosophy

- **Cream paper, not white.** The default page background is `--cream-50` (`#FBF7F0`). Pure white is reserved for cards/sheets that need to lift off the page.
- **Warm neutrals only.** The neutral ramp (`--sandstone-*`) is a true warm gray. Never use cool slate/zinc.
- **Rust as primary.** `--rust-400` (`#C4733F`) is the main brand action color — terracotta, not orange. It echoes UW's brown without feeling like athletic merch.
- **Sage as secondary.** Used for success states, supportive CTAs, and quiet differentiation.
- **One accent at a time.** Don't stack rust + sage + ochre on the same surface. Pick one hero color per view.

### Typography

- **Serif for editorial weight.** Headings, lede paragraphs, quotes, marketing copy. Default serif is Source Serif 4 (substitute for Tiempos Headline; see _Type substitutions_).
- **Sans for UI.** All buttons, form labels, table data, navigation. Inter (substitute for Styrene B).
- **Mono for data.** Course codes (`MATH 2200`), section numbers, time ranges, anything tabular. JetBrains Mono.
- **Tight tracking on display sizes**, normal tracking on body, wide tracking on overlines.
- **Balanced wrapping.** All headings use `text-wrap: balance`; body uses `text-wrap: pretty`.

### Spacing & layout

- **8px base grid.** All spacing tokens are multiples of 4 (`--space-1` = 4) or 8.
- **Generous breathing room.** Marketing pages use `--space-16` (64px) and `--space-20` (80px) section gutters.
- **Max content width** for prose is ~64ch. Don't let serif body run wider.
- **Fixed elements** are rare. The app uses a single fixed top bar and an optional left sidebar; no floating action buttons, no chat bubbles unless there is a chat.

### Backgrounds

- **Solid cream by default.** No gradient page backgrounds.
- **Texture, not gradients.** When a section needs lift, use a slightly darker cream tone (`--cream-100` or `--cream-200`) — not a gradient.
- **Full-bleed imagery** is allowed in marketing hero/section breaks. Imagery should be _warm_ (sunset, sandstone, prairie golden hour); avoid cool blue skies and corporate stock.
- **No repeating patterns** in production UI. (One exception: a subtle topographic line motif may be used as a divider or section break; see `assets/topo-divider.svg`.)
- **No frosted glass / blur** on backgrounds. The aesthetic is paper and ink, not iOS.

### Borders & corners

- **1px borders** in `--border` (sandstone-200) for cards, inputs, table rows. Strong enough to read on cream, soft enough to never feel like a box.
- **Corner radius is restrained.** Default `--radius-md` (10px). Buttons use `--radius-sm` (6px). Pills use `--radius-full`. Avoid 20+ px radii except on hero illustrations or feature cards.
- **No left-border-only accent cards.** That trope is banned.

### Shadows & elevation

- **Soft, warm shadows.** All shadow tokens use a warm sandstone-based RGBA — never `rgba(0,0,0,...)`.
- **Three elevation tiers** in normal use: `--shadow-sm` (cards at rest), `--shadow-md` (popovers, dropdowns), `--shadow-lg` (modals, sheets).
- **Inset shadows** on inputs at rest convey "you can type here" without a heavy border.
- **No glow effects.** No colored shadows. No neon.

### Animation & interaction

- **Short, eased, polite.** All transitions use `--duration-base` (200ms) and `--ease-out`.
- **Hover** is opacity 0.9 on links, a one-shade-darker fill on buttons (`--primary-hover`), and a subtle border darken on cards.
- **Press** uses `--primary-press` (two shades darker) and `transform: translateY(1px)` — a tiny mechanical click. No scale-down bounce.
- **Focus** rings use `--ring` (rust-400) at 2px offset, 2px width. Always visible for keyboard.
- **Page enters** fade up 8px over 240ms. No staggered cascade theatrics.
- **No spring/bounce easing in production UI.** `--ease-spring` exists for occasional marketing moments only.

### Transparency & blur

- Used **rarely**. The modal scrim uses `--overlay` (55% sandstone-900). Popovers, dropdowns, and sheets are fully opaque on `--surface`.
- No frosted-glass nav bars. No translucent cards. The aesthetic is paper.

### Imagery vibe

- **Warm, golden-hour, slightly grainy.** Wyoming sunsets, sandstone, prairie, university buildings in afternoon light.
- **Never cool/blue.** No bluish overcast skies, no neon city shots.
- **Black and white** is acceptable for archival or editorial portrait use.
- **No 3D blobs, no gradients-as-imagery, no abstract corporate illustration.**

### Card pattern

A canonical card:
- Background `--surface` (white) on cream pages, `--surface-2` (cream-50) on white pages.
- 1px `--border`, `--radius-md` (10px), `--shadow-sm`.
- Padding `--space-6` (24px) by default.
- Hover (if interactive): border becomes `--border-strong`, shadow lifts to `--shadow-md`, no transform.

---

## ICONOGRAPHY

uwyoschedule uses **[Lucide](https://lucide.dev)** as its icon system, loaded from the official CDN. Lucide's clean, geometric, single-stroke style sits well next to a serif display face — it stays calm and editorial rather than competing.

**Loaded via:** `<script src="https://unpkg.com/lucide@latest"></script>` then `<i data-lucide="calendar"></i>`.

### Icon rules

- **Stroke width:** 1.75 (Lucide's default is 2; we lighten by 0.25). Set via `lucide.createIcons({ attrs: { 'stroke-width': 1.75 } })`.
- **Sizes:** 16px (inline w/ body), 20px (buttons, nav), 24px (section headers), 32px+ (feature blocks).
- **Color:** inherit from `currentColor`. Default to `--fg-2` for decorative icons, `--fg-1` for functional, `--primary` for action.
- **Padding:** never crop or stretch. If an icon needs a chip, use a `--space-2` padded square with `--radius-sm` background in `--bg-muted`.

### Common icons (Lucide names)

| Use | Icon |
|---|---|
| Schedule / calendar | `calendar`, `calendar-days` |
| Course / class | `book-open` |
| Time | `clock` |
| Location | `map-pin` |
| Filter | `sliders-horizontal` |
| Add | `plus` |
| Remove | `x` |
| Conflict / warning | `triangle-alert` |
| Success | `check-circle-2` |
| Search | `search` |
| Profile | `circle-user` |
| Settings | `settings-2` |

### Logo & marks

The wordmark and a "U" monogram live in `assets/`:
- `logo-wordmark.svg` — the full lockup, "uwyoschedule" in serif.
- `logo-mark.svg` — the standalone monogram in a rust circle.
- `favicon.svg` — small-size monogram.

### Emoji

**No emoji in product UI.** See _Content Fundamentals_.

### Unicode characters

We _do_ use unicode for typographic polish: en-dashes (–), middle dots (·), arrows (→ ←), check (✓), and curly quotes (" "). These should be used directly in copy, not as "icons."

### Substitutions flagged

| What we wanted | What we used | Action |
|---|---|---|
| Tiempos Headline (display serif) | Source Serif 4 (Google Fonts) | Replace with real font files in `fonts/` if licensed. |
| Styrene B (UI sans) | Inter (Google Fonts) | Replace with real font files in `fonts/` if licensed. |
| Söhne Mono (data mono) | JetBrains Mono (Google Fonts) | Replace with real font files in `fonts/` if licensed. |
| Custom UW-themed icon set | Lucide (CDN) | Lucide is excellent and probably the right call long-term. Keep unless a custom set is needed. |

---

## Preview cards

Every preview HTML in `preview/` is registered to the Design System tab and grouped under Brand, Colors, Type, Spacing, or Components. Open the tab to see the full system at a glance.

## How to use

In any HTML file:

```html
<link rel="stylesheet" href="../colors_and_type.css">
<script src="https://unpkg.com/lucide@latest"></script>
<script>lucide.createIcons({ attrs: { 'stroke-width': 1.75 } });</script>
```

Then use the semantic tokens directly:

```html
<article class="card">
  <span class="eyebrow">Fall 2025</span>
  <h2>Build a schedule that fits your life.</h2>
  <p>Pick your classes. We'll find every working combination.</p>
  <button class="btn btn--primary">Build a schedule</button>
</article>
```
