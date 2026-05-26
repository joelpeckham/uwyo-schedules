import { expect, test } from "@playwright/test";

test("landing and planner pages load", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: /UW class schedule planner with a conflict-free week view/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^Open the planner$/i }).first(),
  ).toHaveAttribute("href", "/planner");
  await expect(
    page.getByRole("heading", { name: /Ready to plan your week\?/i }),
  ).toBeVisible();

  await page.goto("/planner");
  await expect(
    page.getByRole("heading", { name: /Your week/i }),
  ).toBeVisible();
});

test("sitemap index and robots", async ({ request }) => {
  const index = await request.get("/sitemap.xml");
  expect(index.status()).toBe(200);
  expect(index.headers()["content-type"]).toMatch(/application\/xml/i);
  const indexBody = await index.text();
  expect(indexBody).toContain("<sitemapindex");
  expect(indexBody).toContain("/sitemap/0.xml");

  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  const robotsBody = await robots.text();
  expect(robotsBody).toContain("Sitemap:");
  expect(robotsBody).toContain("/sitemap.xml");
});

test("llms discovery files", async ({ request }) => {
  const short = await request.get("/llms.txt");
  expect(short.status()).toBe(200);
  expect(short.headers()["content-type"]).toMatch(/text\/plain/i);
  const shortBody = await short.text();
  expect(shortBody).toContain("# uwyoschedule");
  expect(shortBody).toContain("/planner");
  expect(shortBody).toContain("/sitemap.xml");

  const full = await request.get("/llms-full.txt");
  expect(full.status()).toBe(200);
  expect(full.headers()["content-type"]).toMatch(/text\/plain/i);
  const fullBody = await full.text();
  expect(fullBody).toContain("sitemap.xml");
  expect(fullBody).toContain("/terms/{termCode}");
});
