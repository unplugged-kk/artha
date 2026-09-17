import { test, expect } from "../fixtures";
import { createRule, createCategory } from "../helpers/factories";
import { uniqueId } from "../helpers/api";

test.describe("Transaction Rules", () => {
  test("creates a transaction rule through the UI", async ({
    authedPage: page,
  }) => {
    const ruleName = `Auto Zomato ${uniqueId()}`;
    const matchVal = `Zomato ${uniqueId()}`;

    await page.goto("/rules");

    await page
      .getByRole("button", { name: /new rule/i })
      .first()
      .click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByPlaceholder(/e\.g\. Swiggy & Zomato/i).fill(ruleName);
    await dialog.getByPlaceholder(/value to match/i).fill(matchVal);
    // Exact, because the rule-name placeholder above ("e.g. Swiggy & Zomato ->
    // Food & Dining") also contains "e.g. Swiggy" and a loose match is a
    // strict-mode violation.
    await dialog
      .getByPlaceholder("e.g. Swiggy", { exact: true })
      .fill("Zomato Food");

    await dialog.getByRole("button", { name: /create rule/i }).click();

    await expect(page.getByRole("heading", { name: ruleName })).toBeVisible({
      timeout: 10000,
    });
    await page.reload();
    await expect(page.getByRole("heading", { name: ruleName })).toBeVisible();
  });

  test("lists rules seeded via the API", async ({ authedPage: page, api }) => {
    const r1 = await createRule(api, { name: `Rule Uber ${uniqueId()}` });
    const r2 = await createRule(api, { name: `Rule Netflix ${uniqueId()}` });

    await page.goto("/rules");

    await expect(page.getByRole("heading", { name: r1.name })).toBeVisible();
    await expect(page.getByRole("heading", { name: r2.name })).toBeVisible();
  });

  test("tests a rule with sample transaction in test modal", async ({
    authedPage: page,
    api,
  }) => {
    const rule = await createRule(api, {
      name: `Swiggy Rule ${uniqueId()}`,
      conditions: [{ field: "payee", operator: "CONTAINS", value: "Swiggy" }],
    });

    await page.goto("/rules");

    const card = page.locator("div", {
      has: page.getByRole("heading", { name: rule.name }),
    });
    await card.getByRole("button", { name: /test rule/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(rule.name);

    // Enter matching payee
    await dialog
      .getByPlaceholder(/e\.g\. Swiggy Bangalore/i)
      .fill("Swiggy Instant");
    await dialog.getByRole("button", { name: /evaluate sample/i }).click();

    // Verify candidate match
    await expect(dialog.getByText(/candidate matches this rule/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test("toggles rule active state", async ({ authedPage: page, api }) => {
    const rule = await createRule(api, {
      name: `Toggle Rule ${uniqueId()}`,
      isActive: true,
    });

    await page.goto("/rules");

    const card = page.locator("div", {
      has: page.getByRole("heading", { name: rule.name }),
    });
    const toggle = card.getByRole("switch");
    await expect(toggle).toBeChecked();

    await toggle.click();
    await expect(toggle).not.toBeChecked();

    await page.reload();
    const reloadedCard = page.locator("div", {
      has: page.getByRole("heading", { name: rule.name }),
    });
    await expect(reloadedCard.getByRole("switch")).not.toBeChecked();
  });

  test("deletes a rule through the UI", async ({ authedPage: page, api }) => {
    const rule = await createRule(api, { name: `Delete Rule ${uniqueId()}` });

    await page.goto("/rules");

    const card = page.locator("div", {
      has: page.getByRole("heading", { name: rule.name }),
    });
    await card.getByRole("button", { name: /delete/i }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /delete/i }).click();

    await expect(page.getByRole("heading", { name: rule.name })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: rule.name })).toHaveCount(0);
  });
});
