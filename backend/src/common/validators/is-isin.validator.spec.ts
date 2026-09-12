import {
  isValidIsin,
  isinCountryCode,
  normalizeIsin,
} from "./is-isin.validator";

/**
 * Known-good vectors. Each is a real ISIN widely published by its issuer; the
 * point of the check digit is that a single transposed character fails, which
 * the "invalid" cases below assert.
 */
const VALID = ["US0378331005", "INE002A01018", "INE040A01034", "GB0002634946"];

describe("isValidIsin", () => {
  it.each(VALID)("accepts %s", (isin) => {
    expect(isValidIsin(isin)).toBe(true);
  });

  it("accepts a lower-case value, because the stored form is upper-cased", () => {
    expect(isValidIsin("us0378331005")).toBe(true);
  });

  it("rejects a value whose check digit is wrong", () => {
    // The last character of a known-good ISIN, changed by one.
    expect(isValidIsin("US0378331004")).toBe(false);
  });

  it("rejects a value with a transposed pair of characters", () => {
    expect(isValidIsin("US0378331050")).toBe(false);
  });

  it.each([
    ["too short", "US037833100"],
    ["too long", "US03783310055"],
    ["empty", ""],
    ["letters where the check digit belongs", "US037833100A"],
    ["no country prefix", "003783310057"],
    ["blank-ish", "   "],
  ])("rejects %s", (_label, value) => {
    expect(isValidIsin(value)).toBe(false);
  });
});

describe("isinCountryCode", () => {
  it("reads the country prefix", () => {
    expect(isinCountryCode("INE002A01018")).toBe("IN");
    expect(isinCountryCode("US0378331005")).toBe("US");
  });

  it("returns null for a value that is not an ISIN", () => {
    expect(isinCountryCode("nope")).toBeNull();
  });
});

describe("normalizeIsin", () => {
  it("trims and upper-cases", () => {
    expect(normalizeIsin(" ine002a01018 ")).toBe("INE002A01018");
  });
});
