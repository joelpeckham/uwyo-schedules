import { expect, test } from "@playwright/test";

test("home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: /From course list to class schedule/i,
    }),
  ).toBeVisible();
});
