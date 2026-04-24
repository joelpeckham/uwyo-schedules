import { expect, test } from "@playwright/test";

test("home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: /To get started, edit the page.tsx file/i,
    }),
  ).toBeVisible();
});
