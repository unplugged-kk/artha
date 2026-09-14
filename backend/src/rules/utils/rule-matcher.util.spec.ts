import {
  RuleField,
  RuleOperator,
  RuleMatchMode,
} from "../constants/rule.enums";
import {
  evaluateCondition,
  evaluateRule,
  evaluateRules,
} from "./rule-matcher.util";
import { TransactionRule } from "../entities/transaction-rule.entity";

describe("rule-matcher.util", () => {
  describe("evaluateCondition - String operators", () => {
    const candidate = {
      payee: "Swiggy Bangalore",
      memo: "UPI/524312891234/Lunch with colleagues",
      paymentMethod: "UPI",
    };

    it("CONTAINS matches substring case-insensitively", () => {
      expect(
        evaluateCondition(
          {
            field: RuleField.PAYEE,
            operator: RuleOperator.CONTAINS,
            value: "swiggy",
          },
          candidate,
        ),
      ).toBe(true);

      expect(
        evaluateCondition(
          {
            field: RuleField.PAYEE,
            operator: RuleOperator.CONTAINS,
            value: "zomato",
          },
          candidate,
        ),
      ).toBe(false);
    });

    it("NOT_CONTAINS matches when substring is absent", () => {
      expect(
        evaluateCondition(
          {
            field: RuleField.PAYEE,
            operator: RuleOperator.NOT_CONTAINS,
            value: "zomato",
          },
          candidate,
        ),
      ).toBe(true);

      expect(
        evaluateCondition(
          {
            field: RuleField.PAYEE,
            operator: RuleOperator.NOT_CONTAINS,
            value: "swiggy",
          },
          candidate,
        ),
      ).toBe(false);
    });

    it("EQUALS matches exact string case-insensitively", () => {
      expect(
        evaluateCondition(
          {
            field: RuleField.PAYEE,
            operator: RuleOperator.EQUALS,
            value: "swiggy bangalore",
          },
          candidate,
        ),
      ).toBe(true);

      expect(
        evaluateCondition(
          {
            field: RuleField.PAYEE,
            operator: RuleOperator.EQUALS,
            value: "swiggy",
          },
          candidate,
        ),
      ).toBe(false);
    });

    it("NOT_EQUALS matches when string is not exact", () => {
      expect(
        evaluateCondition(
          {
            field: RuleField.PAYEE,
            operator: RuleOperator.NOT_EQUALS,
            value: "swiggy",
          },
          candidate,
        ),
      ).toBe(true);
    });

    it("STARTS_WITH and ENDS_WITH match prefixes and suffixes", () => {
      expect(
        evaluateCondition(
          {
            field: RuleField.PAYEE,
            operator: RuleOperator.STARTS_WITH,
            value: "swiggy",
          },
          candidate,
        ),
      ).toBe(true);

      expect(
        evaluateCondition(
          {
            field: RuleField.PAYEE,
            operator: RuleOperator.ENDS_WITH,
            value: "bangalore",
          },
          candidate,
        ),
      ).toBe(true);

      expect(
        evaluateCondition(
          {
            field: RuleField.PAYEE,
            operator: RuleOperator.ENDS_WITH,
            value: "mumbai",
          },
          candidate,
        ),
      ).toBe(false);
    });

    it("REGEX matches regular expression patterns safely", () => {
      expect(
        evaluateCondition(
          {
            field: RuleField.MEMO,
            operator: RuleOperator.REGEX,
            value: "UPI/\\d{12}/",
          },
          candidate,
        ),
      ).toBe(true);

      expect(
        evaluateCondition(
          {
            field: RuleField.MEMO,
            operator: RuleOperator.REGEX,
            value: "NEFT/\\d{12}/",
          },
          candidate,
        ),
      ).toBe(false);
    });

    it("REGEX fails safely on invalid regex or oversized pattern", () => {
      expect(
        evaluateCondition(
          {
            field: RuleField.MEMO,
            operator: RuleOperator.REGEX,
            value: "[unclosed group",
          },
          candidate,
        ),
      ).toBe(false);

      expect(
        evaluateCondition(
          {
            field: RuleField.MEMO,
            operator: RuleOperator.REGEX,
            value: "a".repeat(300),
          },
          candidate,
        ),
      ).toBe(false);
    });
  });

  describe("evaluateCondition - Numeric & Amount operators", () => {
    it("evaluates GREATER_THAN on positive expense magnitude", () => {
      const expense = { amount: -1500.5 };
      expect(
        evaluateCondition(
          {
            field: RuleField.AMOUNT,
            operator: RuleOperator.GREATER_THAN,
            value: 1000,
          },
          expense,
        ),
      ).toBe(true);

      expect(
        evaluateCondition(
          {
            field: RuleField.AMOUNT,
            operator: RuleOperator.GREATER_THAN,
            value: 2000,
          },
          expense,
        ),
      ).toBe(false);
    });

    it("evaluates LESS_THAN on positive expense magnitude", () => {
      const expense = { amount: -450 };
      expect(
        evaluateCondition(
          {
            field: RuleField.AMOUNT,
            operator: RuleOperator.LESS_THAN,
            value: 500,
          },
          expense,
        ),
      ).toBe(true);

      expect(
        evaluateCondition(
          {
            field: RuleField.AMOUNT,
            operator: RuleOperator.LESS_THAN,
            value: 400,
          },
          expense,
        ),
      ).toBe(false);
    });

    it("evaluates EQUALS for amount", () => {
      const expense = { amount: -500 };
      expect(
        evaluateCondition(
          {
            field: RuleField.AMOUNT,
            operator: RuleOperator.EQUALS,
            value: 500,
          },
          expense,
        ),
      ).toBe(true);
    });

    it("evaluates BETWEEN for amounts", () => {
      const expense = { amount: -750 };
      expect(
        evaluateCondition(
          {
            field: RuleField.AMOUNT,
            operator: RuleOperator.BETWEEN,
            value: [500, 1000] as [number, number],
          },
          expense,
        ),
      ).toBe(true);

      expect(
        evaluateCondition(
          {
            field: RuleField.AMOUNT,
            operator: RuleOperator.BETWEEN,
            value: [800, 1200] as [number, number],
          },
          expense,
        ),
      ).toBe(false);
    });
  });

  describe("evaluateCondition - Account and Type", () => {
    it("evaluates ACCOUNT_ID equality", () => {
      const tx = { accountId: "acc-123" };
      expect(
        evaluateCondition(
          {
            field: RuleField.ACCOUNT_ID,
            operator: RuleOperator.EQUALS,
            value: "acc-123",
          },
          tx,
        ),
      ).toBe(true);

      expect(
        evaluateCondition(
          {
            field: RuleField.ACCOUNT_ID,
            operator: RuleOperator.EQUALS,
            value: "acc-999",
          },
          tx,
        ),
      ).toBe(false);
    });

    it("evaluates TYPE DEBIT (expense) and CREDIT (income)", () => {
      const debitTx = { amount: -500 };
      const creditTx = { amount: 50000 };

      expect(
        evaluateCondition(
          {
            field: RuleField.TYPE,
            operator: RuleOperator.EQUALS,
            value: "DEBIT",
          },
          debitTx,
        ),
      ).toBe(true);

      expect(
        evaluateCondition(
          {
            field: RuleField.TYPE,
            operator: RuleOperator.EQUALS,
            value: "CREDIT",
          },
          debitTx,
        ),
      ).toBe(false);

      expect(
        evaluateCondition(
          {
            field: RuleField.TYPE,
            operator: RuleOperator.EQUALS,
            value: "CREDIT",
          },
          creditTx,
        ),
      ).toBe(true);
    });
  });

  describe("evaluateRule - ALL vs ANY match modes", () => {
    const ruleAll: Partial<TransactionRule> = {
      isActive: true,
      matchMode: RuleMatchMode.ALL,
      conditions: [
        {
          field: RuleField.PAYEE,
          operator: RuleOperator.CONTAINS,
          value: "uber",
        },
        {
          field: RuleField.AMOUNT,
          operator: RuleOperator.GREATER_THAN,
          value: 300,
        },
      ],
    };

    const ruleAny: Partial<TransactionRule> = {
      isActive: true,
      matchMode: RuleMatchMode.ANY,
      conditions: [
        {
          field: RuleField.PAYEE,
          operator: RuleOperator.CONTAINS,
          value: "uber",
        },
        {
          field: RuleField.PAYEE,
          operator: RuleOperator.CONTAINS,
          value: "ola",
        },
      ],
    };

    it("requires ALL conditions to match when matchMode is ALL", () => {
      expect(
        evaluateRule(ruleAll as TransactionRule, {
          payee: "Uber Rides",
          amount: -450,
        }),
      ).toBe(true);

      expect(
        evaluateRule(ruleAll as TransactionRule, {
          payee: "Uber Rides",
          amount: -200,
        }),
      ).toBe(false);
    });

    it("matches if ANY condition matches when matchMode is ANY", () => {
      expect(
        evaluateRule(ruleAny as TransactionRule, {
          payee: "Uber India",
          amount: -100,
        }),
      ).toBe(true);

      expect(
        evaluateRule(ruleAny as TransactionRule, {
          payee: "Ola Cabs",
          amount: -100,
        }),
      ).toBe(true);

      expect(
        evaluateRule(ruleAny as TransactionRule, {
          payee: "Rapido",
          amount: -100,
        }),
      ).toBe(false);
    });

    it("returns false if rule is inactive", () => {
      const inactiveRule = { ...ruleAll, isActive: false };
      expect(
        evaluateRule(inactiveRule as TransactionRule, {
          payee: "Uber Rides",
          amount: -500,
        }),
      ).toBe(false);
    });
  });

  describe("evaluateRules - Priority and execution order", () => {
    const rules: TransactionRule[] = [
      {
        id: "rule-high",
        userId: "user-1",
        name: "High Priority: Swiggy Instamart -> Groceries",
        priority: 1,
        isActive: true,
        matchMode: RuleMatchMode.ALL,
        conditions: [
          {
            field: RuleField.PAYEE,
            operator: RuleOperator.CONTAINS,
            value: "swiggy instamart",
          },
        ],
        actions: {
          setCategoryId: "cat-groceries",
          stopProcessing: true,
        },
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      },
      {
        id: "rule-low",
        userId: "user-1",
        name: "Low Priority: Swiggy General -> Dining",
        priority: 10,
        isActive: true,
        matchMode: RuleMatchMode.ALL,
        conditions: [
          {
            field: RuleField.PAYEE,
            operator: RuleOperator.CONTAINS,
            value: "swiggy",
          },
        ],
        actions: {
          setCategoryId: "cat-dining",
          stopProcessing: true,
        },
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      },
    ];

    it("evaluates in ascending priority order (lower priority number first)", () => {
      const matchInstamart = evaluateRules(rules, {
        payee: "Swiggy Instamart Koramangala",
        amount: -800,
      });

      expect(matchInstamart).not.toBeNull();
      expect(matchInstamart?.matchedRuleId).toBe("rule-high");
      expect(matchInstamart?.actions.setCategoryId).toBe("cat-groceries");

      const matchGeneral = evaluateRules(rules, {
        payee: "Swiggy Food Delivery",
        amount: -450,
      });

      expect(matchGeneral).not.toBeNull();
      expect(matchGeneral?.matchedRuleId).toBe("rule-low");
      expect(matchGeneral?.actions.setCategoryId).toBe("cat-dining");
    });

    it("returns null when no rules match", () => {
      const noMatch = evaluateRules(rules, {
        payee: "Amazon India",
        amount: -1200,
      });

      expect(noMatch).toBeNull();
    });
  });
});
