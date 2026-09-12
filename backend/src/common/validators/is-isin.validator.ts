import { applyDecorators } from "@nestjs/common";
import {
  IsString,
  Matches,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";

/**
 * The structural shape of an ISIN (ISO 6166): two uppercase letters for the
 * country, nine alphanumerics, and a decimal check digit -- twelve characters.
 */
export const ISIN_PATTERN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

/** The country prefix of an ISIN, or null when the value is not an ISIN. */
export function isinCountryCode(isin: string): string | null {
  const value = isin.trim().toUpperCase();
  return ISIN_PATTERN.test(value) ? value.slice(0, 2) : null;
}

/**
 * Whether an ISIN's final character is its real check digit.
 *
 * A regex cannot express this: the algorithm expands each letter to the two
 * digits of its `A=10..Z=35` value, then requires the whole expanded string to
 * pass Luhn (the check digit is the last digit, so a valid ISIN sums to a
 * multiple of ten). This is what catches a mistyped or invented identifier that
 * happens to have the right shape -- the case a bare pattern would wave through.
 *
 * Structural validity is assumed: call only with a string that already matches
 * `ISIN_PATTERN`.
 */
export function isIsinCheckDigitValid(isin: string): boolean {
  const expanded = isin
    .trim()
    .toUpperCase()
    .replace(/[A-Z]/g, (char) => String(char.charCodeAt(0) - 55));
  let sum = 0;
  // Right to left: the rightmost digit is not doubled, and every second digit
  // after it is (Luhn, applied to the whole expanded string including the
  // check digit).
  let double = false;
  for (let i = expanded.length - 1; i >= 0; i -= 1) {
    let digit = Number(expanded[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Shape and check digit both valid. Never throws on a non-ISIN shape. */
export function isValidIsin(value: string): boolean {
  const candidate = (value ?? "").trim().toUpperCase();
  return ISIN_PATTERN.test(candidate) && isIsinCheckDigitValid(candidate);
}

/** Canonical stored form: trimmed and upper-cased. */
export function normalizeIsin(value: string): string {
  return (value ?? "").trim().toUpperCase();
}

@ValidatorConstraint({ name: "isIsin", async: false })
class IsIsinConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === "string" && isValidIsin(value);
  }

  defaultMessage(): string {
    return "ISIN must be 12 characters (2-letter country, 9 alphanumerics, check digit) with a valid check digit";
  }
}

/**
 * Validates a full ISIN, check digit included.
 *
 * Use this instead of `@Matches(ISIN_PATTERN)` or a hand-rolled length check so
 * identity validation stays consistent across every DTO and the import path.
 */
export function IsIsin(): PropertyDecorator {
  return applyDecorators(
    IsString(),
    Matches(ISIN_PATTERN),
    Validate(IsIsinConstraint),
  );
}
