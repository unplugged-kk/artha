import { test, expect, type Page } from "../fixtures";
import { createAccount } from "../helpers/factories";
import { uniqueId, type ApiClient } from "../helpers/api";
import { minimalXlsx } from "../helpers/xlsx-fixture";

/**
 * A household tracker workbook names each row's account in a Source column.
 * Runbook A1: Bank opens at 1,000, Card at 0. Rows: Oct 31 Bank groceries 100,
 * Nov 1 Card fuel 40, Nov 2 Bank -> Card payment 40, Nov 3 Bank groceries 100.
 * Bank must close at 760, the card at 0, and the payment add no expense.
 */
function trackerWorkbook(id: string): Buffer {
  return minimalXlsx("Transactions", [
    ["Synthetic tracker"],
    ["Currency", "INR"],
    [],
    ["#", "Date", "Amount (\u20b9)", "Source", "Description", "Payee"],
    [1, "2026-10-31", 100, `Test Bank ${id}`, "Groceries", "Synthetic Shop"],
    [2],
    [3, "2026-11-01", 40, `Test Card ${id}`, "Fuel", "Synthetic Fuel"],
    [4, "2026-11-02", 40, `Test Bank ${id}`, "Card payment", "Card payment"],
    [5, "2026-11-03", 100, `Test Bank ${id}`, "Groceries", "Synthetic Shop"],
    ["TOTAL EXPENSES", "", 280],
  ]);
}

async function importTracker(
  page: Page,
  id: string,
  buffer: Buffer,
  fileName: string,
) {
  await page.goto("/import");
  await page.locator('input[type="file"]').setInputFiles({
    name: fileName,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer,
  });
  await expect(
    page.getByRole("heading", { name: /select sheet/i }),
  ).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: /^continue$/i }).click();

  // Column mapping: Source and Payee are auto-matched; positive amounts are spending.
  await expect(page.getByLabel(/account \/ source/i)).toHaveValue("3");
  await page
    .getByRole("combobox")
    .filter({ hasText: "As-is (positive = deposit)" })
    .selectOption({ label: "Reverse (positive = withdrawal)" });
  await page.getByRole("button", { name: /add rule/i }).click();
  await page.getByPlaceholder(/./).last().fill("Card payment");
  await page
    .locator("select")
    .filter({ hasText: /select account/i })
    .last()
    .selectOption({ label: `Test Card ${id}` });
  await page.getByRole("button", { name: /^next$/i }).click();

  // Each source label was matched to the account of the same name.
  await expect(
    page.getByRole("heading", { name: /match sources to accounts/i }),
  ).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: /^next$/i }).click();

  // Transfer counterparty mapping, then the row-level review.
  const mapTransfers = page.getByRole("heading", {
    name: /map transfer accounts/i,
  });
  if (await mapTransfers.isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.getByRole("button", { name: /^next$/i }).click();
  }
  await expect(
    page.getByRole("heading", { name: /review import/i }),
  ).toBeVisible({ timeout: 10000 });
}

async function balances(api: ApiClient, id: string) {
  const accounts =
    await api.get<Array<{ name: string; currentBalance: number }>>("/accounts");
  const of = (name: string) =>
    Number(accounts.find((a) => a.name === `${name} ${id}`)?.currentBalance);
  return { bank: of("Test Bank"), card: of("Test Card") };
}

test("mixed-account tracker workbook posts each row to its source account", async ({
  authedPage: page,
  api,
}) => {
  const id = uniqueId();
  await createAccount(api, {
    name: `Test Bank ${id}`,
    currencyCode: "INR",
    openingBalance: 1000,
  });
  await createAccount(api, {
    name: `Test Card ${id}`,
    accountType: "CREDIT_CARD",
    currencyCode: "INR",
  });
  const workbook = trackerWorkbook(id);

  await importTracker(page, id, workbook, "november.xlsx");
  // The review states each account's change before anything is written.
  const changes = page
    .getByRole("list")
    .filter({ hasText: `Test Bank ${id}` })
    .first();
  await expect(changes).toContainText(/-\s?₹240\.00|₹-240\.00|-240/);
  await page.screenshot({
    path: "test-results/import-xlsx-mixed-review.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /import transactions/i }).click();
  await expect(
    page.getByRole("heading", { name: /import complete/i }),
  ).toBeVisible({ timeout: 20000 });
  expect(await balances(api, id)).toEqual({ bank: 760, card: 0 });

  // A retry of the same workbook under another name moves no balance.
  await importTracker(page, id, workbook, "november (1).xlsx");
  await page.getByRole("button", { name: /import transactions/i }).click();
  await expect(
    page.getByRole("heading", { name: /import complete/i }),
  ).toBeVisible({ timeout: 20000 });
  await expect(page.locator("li", { hasText: /imported:/i })).toContainText(
    "0",
  );
  expect(await balances(api, id)).toEqual({ bank: 760, card: 0 });

  // The register agrees after a reload.
  await page.goto("/transactions");
  await page.reload();
  expect(await balances(api, id)).toEqual({ bank: 760, card: 0 });
});
