import { applyDecorators } from "@nestjs/common";
import { IsString, Matches } from "class-validator";

/**
 * An AMFI scheme code: the numeric identifier a mutual-fund scheme carries in
 * the AMFI/mfapi.in catalogue (e.g. `122639`). Digits only, up to ten.
 *
 * Stored as text, not a number: it is an identifier, never arithmetic, and a
 * numeric column would invite a leading-zero or precision question that the
 * identifier does not have.
 */
export const AMFI_SCHEME_CODE_PATTERN = /^\d{1,10}$/;

/** Shape-valid AMFI scheme code. `"0"` is rejected -- no scheme has that code. */
export function isValidAmfiSchemeCode(value: string): boolean {
  const candidate = (value ?? "").trim();
  return AMFI_SCHEME_CODE_PATTERN.test(candidate) && Number(candidate) > 0;
}

/** Canonical stored form: trimmed. */
export function normalizeAmfiSchemeCode(value: string): string {
  return (value ?? "").trim();
}

/**
 * Validates an AMFI scheme code. Use this instead of `@IsNumberString()` so the
 * "no scheme is 0" rule has one home shared by the DTO and the import path.
 */
export function IsAmfiSchemeCode(): PropertyDecorator {
  return applyDecorators(
    IsString(),
    Matches(AMFI_SCHEME_CODE_PATTERN, {
      message: "AMFI scheme code must be 1-10 digits",
    }),
  );
}
