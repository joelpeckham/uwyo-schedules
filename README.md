This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, install dependencies and run the development server (this repo uses pnpm):

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `src/app/page.tsx`. The page auto-updates as you edit the file.

## Design system

The brand kit (tokens, copy guidelines, HTML previews, UI kit) lives in **`design-system/`**. A Cursor agent skill that points to it is at **`.cursor/skills/uwyoSchedules-design/SKILL.md`**. SVG logos and the favicon are also under **`public/brand/`** for use in the Next.js app.

## SEO

- **Canonical site:** `https://uwyoschedule.org` (override with `NEXT_PUBLIC_SITE_URL` in `.env.local` for previews).
- **Discovery:** [`/sitemap.xml`](https://uwyoschedule.org/sitemap.xml) and [`/robots.txt`](https://uwyoschedule.org/robots.txt) are generated from the App Router.
- **Search Console:** After deploying, add the property in [Google Search Console](https://search.google.com/search-console), set the DNS or HTML verification token in `GOOGLE_SITE_VERIFICATION` (see `.env.example`), redeploy, then submit the sitemap URL above under **Sitemaps**.
- **Bing:** In [Bing Webmaster Tools](https://www.bing.com/webmasters), import the site and submit the same sitemap URL.
- **Instructor URLs:** Optional; set `SEO_INSTRUCTOR_PAGES=1` to index `/instructors/[slug]` (off by default).

## Testing

- **Unit and component tests (Vitest):** `pnpm test` (watch) or `pnpm test:run` (CI mode).
- **End-to-end (Playwright):** `pnpm exec playwright install chromium` once per machine, then `pnpm test:e2e`. The dev server uses port `45123` by default (override with `E2E_PORT`).

Fonts load through [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) (Inter, Source Serif 4, JetBrains Mono).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

Connect this repository in the [Vercel dashboard](https://vercel.com/new). Next.js is detected automatically; no `vercel.json` is required for a standard app. Node version follows [`.nvmrc`](.nvmrc) locally and in GitHub Actions; set the same major version under **Project → Settings → Node.js Version** in Vercel if you want them aligned.

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
