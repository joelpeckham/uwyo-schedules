import { expect, test } from "@playwright/test";

test("landing and planner pages load", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: /Build a UW class schedule that fits your life/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^Build a schedule$/i }),
  ).toHaveAttribute("href", "/planner");

  await page.goto("/planner");
  await expect(
    page.getByRole("heading", { name: /Your week/i }),
  ).toBeVisible();
});
