import { decideCategory, normalizeMerchant } from "./categorization-pipeline";

const base = {
  payee: "Swiggy *4421",
  ruleCategoryId: null,
  merchantDefaults: { swiggy: "food" },
  historyCategoryIds: [] as string[],
};

describe("normalizeMerchant", () => {
  it.each([
    ["SWIGGY *1234", "swiggy"],
    ["Amazon Pay India #9", "amazon pay india"],
    ["  Zomato--Order 77 ", "zomato order"],
    ["", ""],
  ])("%s -> %s", (raw, out) => expect(normalizeMerchant(raw)).toBe(out));
});

describe("decideCategory", () => {
  it("a user rule wins over everything", () => {
    expect(
      decideCategory({
        ...base,
        ruleCategoryId: "mine",
        historyCategoryIds: ["x", "x", "x"],
      }),
    ).toMatchObject({ tier: "user_rule", categoryId: "mine", confidence: 1 });
  });

  it("falls to the merchant default when no rule matches", () => {
    expect(decideCategory(base)).toMatchObject({
      tier: "merchant_default",
      categoryId: "food",
    });
  });

  it("uses history only with enough samples and dominance", () => {
    const d = decideCategory({
      ...base,
      payee: "Local Kirana",
      historyCategoryIds: ["groc", "groc", "groc", "groc", "misc"],
    });
    expect(d).toMatchObject({
      tier: "history",
      categoryId: "groc",
      confidence: 0.8,
    });
  });

  it("two samples are not enough: ask AI, with the weak candidate as a hint", () => {
    expect(
      decideCategory({
        ...base,
        payee: "Local Kirana",
        historyCategoryIds: ["groc", "groc"],
      }),
    ).toEqual({ status: "needs_ai", hints: ["groc"] });
  });

  it("a split history is not dominant", () => {
    expect(
      decideCategory({
        ...base,
        payee: "Local Kirana",
        historyCategoryIds: ["a", "a", "b", "b", "c"],
      }).status,
    ).toBe("needs_ai");
  });

  it("an unknown payee with no history needs AI and offers no hints", () => {
    expect(
      decideCategory({ ...base, payee: "Zzz", historyCategoryIds: [] }),
    ).toEqual({
      status: "needs_ai",
      hints: [],
    });
  });

  it("an empty payee never matches a merchant default", () => {
    expect(
      decideCategory({ ...base, payee: "***", merchantDefaults: { "": "bad" } })
        .status,
    ).toBe("needs_ai");
  });
});
