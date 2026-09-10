import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { VerifyTotpDto } from "./verify-totp.dto";

function createDto(
  partial: Partial<Record<keyof VerifyTotpDto, unknown>>,
): VerifyTotpDto {
  return plainToInstance(VerifyTotpDto, {
    tempToken: "valid-temp-token",
    code: "123456",
    ...partial,
  });
}

describe("VerifyTotpDto", () => {
  // ---- valid inputs ----

  it("accepts a 6-digit TOTP code", async () => {
    const dto = createDto({ code: "123456" });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("accepts a lowercase XXXX-XXXX backup code", async () => {
    const dto = createDto({ code: "a1b2-c3d4" });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("accepts an uppercase XXXX-XXXX backup code", async () => {
    const dto = createDto({ code: "A1B2-C3D4" });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("accepts a mixed-case XXXX-XXXX backup code", async () => {
    const dto = createDto({ code: "aB1c-D2eF" });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("accepts rememberDevice as true", async () => {
    const dto = createDto({ rememberDevice: true });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("accepts omitted rememberDevice", async () => {
    const dto = createDto({});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  // ---- invalid codes ----

  it("rejects backup code without dash", async () => {
    const dto = createDto({ code: "a1b2c3d4" });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe("code");
  });

  it("rejects 5-digit numeric code", async () => {
    const dto = createDto({ code: "12345" });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe("code");
  });

  it("rejects 7-digit numeric code", async () => {
    const dto = createDto({ code: "1234567" });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe("code");
  });

  it("rejects backup code with wrong separator", async () => {
    const dto = createDto({ code: "a1b2_c3d4" });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe("code");
  });

  it("rejects backup code with non-hex characters", async () => {
    const dto = createDto({ code: "g1h2-i3j4" });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe("code");
  });

  it("rejects too-short backup code", async () => {
    const dto = createDto({ code: "a1b-c3d4" });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe("code");
  });

  it("rejects empty code", async () => {
    const dto = createDto({ code: "" });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  // ---- invalid tempToken ----

  it("rejects missing tempToken", async () => {
    const dto = createDto({ tempToken: undefined });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe("tempToken");
  });

  // ---- invalid rememberDevice ----

  it("rejects non-boolean rememberDevice", async () => {
    const dto = createDto({ rememberDevice: "yes" });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe("rememberDevice");
  });
});
