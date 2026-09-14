import { test, expect } from "../fixtures";
import { createWatchlist, createSecurity } from "../helpers/factories";
import { uniqueId } from "../helpers/api";

test.describe("Watchlists", () => {
  test("creates a watchlist through the UI", async ({ authedPage: page }) => {
    const name = `Tech Radar ${uniqueId()}`;
    const description = `Top tech stocks ${uniqueId()}`;

    await page.goto("/watchlists");

    // Click button to open create modal (either New Watchlist or Create First Watchlist)
    const newBtn = page.getByRole("button", { name: /watchlist/i }).first();
    await newBtn.click();

    const dialog = page.getByRole("dialog");
    await dialog.locator("#watchlist-name").fill(name);
    await dialog.locator("#watchlist-description").fill(description);
    await dialog.getByRole("button", { name: /create/i }).click();

    await expect(page.getByRole("button", { name })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(description)).toBeVisible();

    await page.reload();
    await expect(page.getByRole("button", { name })).toBeVisible();
  });

  test("lists watchlists seeded via the API", async ({
    authedPage: page,
    api,
  }) => {
    const w1 = await createWatchlist(api, { name: `Blue Chips ${uniqueId()}` });
    const w2 = await createWatchlist(api, { name: `Growth ${uniqueId()}` });

    await page.goto("/watchlists");

    await expect(page.getByRole("button", { name: w1.name })).toBeVisible();
    await expect(page.getByRole("button", { name: w2.name })).toBeVisible();
  });

  test("adds a security to a watchlist", async ({ authedPage: page, api }) => {
    const symbol = `W${uniqueId().slice(-5).toUpperCase()}`;
    const secName = `Watch Security ${uniqueId()}`;
    const security = await createSecurity(api, { symbol, name: secName });
    const watchlist = await createWatchlist(api, {
      name: `Monitor ${uniqueId()}`,
    });

    await page.goto("/watchlists");

    // Select the newly created watchlist if multiple exist
    await page.getByRole("button", { name: watchlist.name }).click();

    // Click Add Security
    await page.getByRole("button", { name: /add security/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Search for the security
    await dialog.locator('input[type="text"]').fill(symbol);

    // Click Add next to the found security
    const row = dialog.locator("div", { hasText: symbol }).last();
    await row.getByRole("button", { name: /add/i }).click();

    // Verify security is listed in the items table
    await expect(page.locator("table", { hasText: symbol })).toBeVisible({
      timeout: 10000,
    });
  });

  test("deletes a watchlist through the UI", async ({
    authedPage: page,
    api,
  }) => {
    const watchlist = await createWatchlist(api, {
      name: `Delete List ${uniqueId()}`,
    });

    await page.goto("/watchlists");
    await page.getByRole("button", { name: watchlist.name }).click();

    // Click the delete button on the watchlist header actions
    await page.getByRole("button", { name: /delete watchlist/i }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /delete/i }).click();

    await expect(
      page.getByRole("button", { name: watchlist.name }),
    ).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByRole("button", { name: watchlist.name }),
    ).toHaveCount(0);
  });
});
