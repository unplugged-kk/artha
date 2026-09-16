import { test, expect } from "../fixtures";
import { createAccount, createCurrency } from "../helpers/factories";
import { type ApiClient, uniqueId } from "../helpers/api";

/**
 * An INR account, with the currency set up the way a user would.
 *
 * A fresh instance seeds no currencies -- the catalogue is built on demand from
 * the user's first use of one (`CurrenciesService.ensureSystemCurrency`), and a
 * new user's list holds only their default. Creating an account whose currency
 * has no row yet fails its `currency_code` foreign key, so the currency comes
 * first. Idempotent across the tests here: each runs as its own user, and the
 * second call takes the "currency already exists, add it to my list" branch.
 */
async function createInrAccount(api: ApiClient, name: string) {
  await createCurrency(api, {
    code: "INR",
    name: "Indian Rupee",
    symbol: "₹",
    decimalPlaces: 2,
  });
  return createAccount(api, { name, currencyCode: "INR" });
}

test.describe("Indian Bank SMS Intake", () => {
  test("parses and imports a bank SMS end-to-end", async ({
    authedPage: page,
    api,
  }) => {
    const account = await createInrAccount(api, `HDFC Salary ${uniqueId()}`);

    const upiRef = `4257${uniqueId().slice(-8).padStart(8, "0")}`;
    const sms = `Rs.450.00 debited from HDFC Bank A/C **1234 on 14-09-26 to VPA swiggy@icici (UPI Ref No ${upiRef}). Avl Bal: Rs.25,000.00.`;

    await page.goto("/import");

    // Switch to SMS intake tab
    await page.getByRole("button", { name: /bank sms intake/i }).click();

    // Fill SMS and optional sender
    await page.locator("textarea").fill(sms);
    await page.locator('input[placeholder*="VM-HDFCBK"]').fill("VM-HDFCBK");

    // Click Parse
    await page.getByRole("button", { name: /parse sms/i }).click();

    // Verify candidate preview
    await expect(page.getByText(/transaction candidate/i)).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("HDFC", { exact: true })).toBeVisible();
    await expect(page.getByText(/swiggy@icici/i)).toBeVisible();
    await expect(page.getByText("UPI", { exact: true })).toBeVisible();

    // Select target account and import
    await page
      .getByLabel(/destination account/i)
      .selectOption({ value: account.id });
    await page.getByRole("button", { name: /import transaction/i }).click();

    // Verify success banner
    await expect(
      page.getByText(/transaction successfully imported/i),
    ).toBeVisible({ timeout: 10000 });

    // Verify transaction appears in the transactions list
    await page.goto("/transactions");
    await expect(page.locator("tr", { hasText: "450" })).toBeVisible({
      timeout: 10000,
    });
  });

  test("detects duplicate SMS and skips re-importing", async ({
    authedPage: page,
    api,
  }) => {
    const account = await createInrAccount(
      api,
      `HDFC Checking ${uniqueId()}`,
    );

    const upiRef = `9999${uniqueId().slice(-8).padStart(8, "0")}`;
    const sms = `Rs.250.00 debited from HDFC Bank A/C **1234 on 14-09-26 to VPA zomato@icici (UPI Ref No ${upiRef}). Avl Bal: Rs.20,000.00.`;

    await page.goto("/import");
    await page.getByRole("button", { name: /bank sms intake/i }).click();

    // First import
    await page.locator("textarea").fill(sms);
    await page.locator('input[placeholder*="VM-HDFCBK"]').fill("VM-HDFCBK");
    await page.getByRole("button", { name: /parse sms/i }).click();

    await expect(page.getByText(/transaction candidate/i)).toBeVisible({
      timeout: 10000,
    });
    await page
      .getByLabel(/destination account/i)
      .selectOption({ value: account.id });
    await page.getByRole("button", { name: /import transaction/i }).click();
    await expect(
      page.getByText(/transaction successfully imported/i),
    ).toBeVisible({ timeout: 10000 });

    // Second import with the same SMS
    await page.getByRole("button", { name: /import another sms/i }).click();
    await page.locator("textarea").fill(sms);
    await page.locator('input[placeholder*="VM-HDFCBK"]').fill("VM-HDFCBK");
    await page.getByRole("button", { name: /parse sms/i }).click();

    await expect(page.getByText(/transaction candidate/i)).toBeVisible({
      timeout: 10000,
    });
    // Candidate should warn or note existing duplicate
    await expect(
      page.getByText(/already imported|existing transaction/i),
    ).toBeVisible({ timeout: 5000 });
  });
});
