import { expect, test } from "@playwright/test";

test.describe("Planner interactions", () => {
  test("course search resolves to results or empty state when catalog UI is mounted", async ({
    page,
  }) => {
    await page.goto("/planner");
    await expect(
      page.getByRole("heading", { name: /Your week/i }),
    ).toBeVisible();

    const addButton = page.getByRole("button", { name: /^Add$/ });
    const plannerReady = await addButton
      .waitFor({ state: "visible", timeout: 15_000 })
      .then(() => true)
      .catch(() => false);

    test.skip(
      !plannerReady,
      "Planner catalog UI requires term data (ingested DB + session)",
    );

    await addButton.click();
    const searchInput = page.locator("#course-search");
    await expect(searchInput).toBeVisible();
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

    // WeekCalendar is dynamically imported; the toolbar can paint before handlers attach.
    await expect(async () => {
      await markBusy.click();
      await expect(
        page.getByRole("button", { name: /^Stop marking busy time$/ }),
      ).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: 15_000 });

    const stopMarking = page.getByRole("button", {
      name: /^Stop marking busy time$/,
    });
    await expect(stopMarking).toHaveAttribute("aria-pressed", "true");
    await stopMarking.click();
    await expect(markBusy).toHaveAttribute("aria-pressed", "false");
  });
});
