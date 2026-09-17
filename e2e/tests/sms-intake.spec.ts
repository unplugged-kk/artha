import { test, expect, type Page } from "../fixtures";
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

/**
 * A UPI debit SMS in the shape the backend's parsers accept -- the same fixture
 * `backend/src/import/sms/indian-bank-sms-pipeline.spec.ts` uses -- so the
 * assertions below can name what the parser extracts rather than guess: bank
 * "HDFC Bank", payee "swiggy", rail "UPI".
 */
function upiDebitSms(amount: string, vpa: string, ref: string): string {
  return (
    `Rs.${amount} debited from HDFC Bank A/C **1234 on 14-09-26 ` +
    `to VPA ${vpa} (UPI Ref No ${ref}). Avl Bal: Rs.25,000.00.`
  );
}

/**
 * The sender header field. The placeholder is an example list ("e.g. VK-HDFCBK,
 * AX-ICICIB, BZ-SBIINB"), so the label is the stable handle; the value is the
 * sender one of those patterns normalizes out of, as the backend fixtures use.
 */
async function fillSms(page: Page, sms: string) {
  await page.locator("textarea").fill(sms);
  await page.getByLabel(/sender header/i).fill("VM-HDFCBK");
  await page.getByRole("button", { name: /parse sms/i }).click();
}

/** The register's transaction rows, excluding the day-group header rows. */
function registerRow(page: Page, text: string) {
  return page.locator('tr:not([data-testid^="day-group-"])', { hasText: text });
}

test.describe("Indian Bank SMS Intake", () => {
  test("parses and imports a bank SMS end-to-end", async ({
    authedPage: page,
    api,
  }) => {
    const account = await createInrAccount(api, `HDFC Salary ${uniqueId()}`);
    const upiRef = `4257${uniqueId().slice(-8).padStart(8, "0")}`;

    await page.goto("/import");
    await page.getByRole("button", { name: /bank sms intake/i }).click();

    await fillSms(page, upiDebitSms("450.00", "swiggy@icici", upiRef));

    // The candidate card names what the parser read out of the message. Exact,
    // because the raw SMS still sits in the textarea and contains all three.
    await expect(page.getByText(/transaction candidate/i)).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("HDFC Bank", { exact: true })).toBeVisible();
    await expect(page.getByText("swiggy", { exact: true })).toBeVisible();
    await expect(page.getByText("UPI", { exact: true })).toBeVisible();

    await page
      .getByLabel(/destination account/i)
      .selectOption({ value: account.id });
    await page.getByRole("button", { name: /import transaction/i }).click();

    await expect(
      // `.first()`: the same copy lands in both the toast and the result card,
      // and either proves the import was reported.
      page.getByText(/transaction imported successfully into/i).first(),
    ).toBeVisible({ timeout: 10000 });

    // The imported row reaches the register.
    await page.goto("/transactions");
    await expect(registerRow(page, "450")).toBeVisible({ timeout: 10000 });
  });

  test("detects duplicate SMS and skips re-importing", async ({
    authedPage: page,
    api,
  }) => {
    const account = await createInrAccount(api, `HDFC Checking ${uniqueId()}`);
    const upiRef = `9999${uniqueId().slice(-8).padStart(8, "0")}`;
    const sms = upiDebitSms("250.00", "zomato@icici", upiRef);

    await page.goto("/import");
    await page.getByRole("button", { name: /bank sms intake/i }).click();

    // First import.
    await fillSms(page, sms);
    await expect(page.getByText(/transaction candidate/i)).toBeVisible({
      timeout: 10000,
    });
    await page
      .getByLabel(/destination account/i)
      .selectOption({ value: account.id });
    await page.getByRole("button", { name: /import transaction/i }).click();
    await expect(
      page.getByText(/transaction imported successfully into/i).first(),
    ).toBeVisible({ timeout: 10000 });

    // The same SMS again: import identity makes the second one a skip, and the
    // duplicate is reported when it is imported, not when it is parsed.
    // `.first()`: the form and the result card both offer "Parse Another SMS",
    // and both run the same reset.
    await page.getByRole("button", { name: /parse another sms/i }).first().click();
    await fillSms(page, sms);
    await expect(page.getByText(/transaction candidate/i)).toBeVisible({
      timeout: 10000,
    });
    await page
      .getByLabel(/destination account/i)
      .selectOption({ value: account.id });
    await page.getByRole("button", { name: /import transaction/i }).click();

    await expect(page.getByText(/skipped duplicate/i).first()).toBeVisible({
      timeout: 10000,
    });
  });
});
