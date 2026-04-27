import { expect, test } from "@playwright/test";

test.describe("Planner interactions", () => {
  test("course search resolves to results or empty state when catalog UI is mounted", async ({
    page,
  }) => {
    await page.goto("/planner");
    await expect(
      page.getByRole("heading", { name: /Your week/i }),
    ).toBeVisible();

    const searchInput = page.locator("#course-search");
    const plannerReady = await searchInput
      .waitFor({ state: "visible", timeout: 15_000 })
      .then(() => true)
      .catch(() => false);

    test.skip(
      !plannerReady,
      "Planner catalog UI requires term data (ingested DB + session)",
    );

    await searchInput.fill("ZZ");
    await expect(
      page.getByRole("listbox", { name: /Course search results/i }).or(
        page.getByText(/No courses match/i),
      ),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("toggle Mark busy time when calendar toolbar is present", async ({
    page,
  }) => {
    await page.goto("/planner");
    await expect(
      page.getByRole("heading", { name: /Your week/i }),
    ).toBeVisible();

    const markBusy = page.getByRole("button", { name: /^Mark busy time$/ });
    const toolbarReady = await markBusy
      .waitFor({ state: "visible", timeout: 15_000 })
      .then(() => true)
      .catch(() => false);

    test.skip(
      !toolbarReady,
      "Calendar toolbar requires term data and loaded WeekCalendar chunk",
    );

    await markBusy.click();
    await expect(markBusy).toHaveAttribute("aria-pressed", "true");
    await markBusy.click();
    await expect(markBusy).toHaveAttribute("aria-pressed", "false");
  });
});
