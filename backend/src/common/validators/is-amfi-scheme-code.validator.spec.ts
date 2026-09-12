import {
  isValidAmfiSchemeCode,
  normalizeAmfiSchemeCode,
} from "./is-amfi-scheme-code.validator";

describe("isValidAmfiSchemeCode", () => {
  it.each(["122639", "1", "1001234567"])("accepts %s", (code) => {
    expect(isValidAmfiSchemeCode(code)).toBe(true);
  });

  it("trims before validating", () => {
    expect(isValidAmfiSchemeCode(" 122639 ")).toBe(true);
  });

  it.each([
    ["zero", "0"],
    ["empty", ""],
    ["blank", "   "],
    ["letters", "ABC123"],
    ["too long", "12345678901"],
    ["a decimal", "122639.0"],
    ["negative", "-122639"],
  ])("rejects %s", (_label, code) => {
    expect(isValidAmfiSchemeCode(code)).toBe(false);
  });
});

describe("normalizeAmfiSchemeCode", () => {
  it("trims", () => {
    expect(normalizeAmfiSchemeCode("  122639 ")).toBe("122639");
  });
});
