import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { CategorizationController } from "./categorization.controller";
import { SuggestCategoryDto } from "./dto/suggest-category.dto";

describe("CategorizationController", () => {
  it("passes the authenticated user id, never one from the body", async () => {
    const suggest = jest
      .fn()
      .mockResolvedValue({ decision: { status: "needs_ai", hints: [] } });
    const controller = new CategorizationController({ suggest } as any);
    await controller.suggest({ user: { id: "u1" } }, { payee: "Shop" } as any);
    expect(suggest).toHaveBeenCalledWith("u1", { payee: "Shop" });
  });
});

describe("SuggestCategoryDto", () => {
  const errors = async (body: object) =>
    (await validate(plainToInstance(SuggestCategoryDto, body))).length;

  it("requires a bounded payee", async () => {
    expect(await errors({ payee: "Swiggy" })).toBe(0);
    expect(await errors({ payee: "" })).toBeGreaterThan(0);
    expect(await errors({})).toBeGreaterThan(0);
    expect(await errors({ payee: "x".repeat(256) })).toBeGreaterThan(0);
  });

  it("rejects a malformed account id", async () => {
    expect(
      await errors({ payee: "x", accountId: "not-a-uuid" }),
    ).toBeGreaterThan(0);
  });
});
