import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PatScopeGuard } from "./pat-scope.guard";
import { REQUIRE_SCOPE_KEY } from "../decorators/require-scope.decorator";

describe("PatScopeGuard", () => {
  let guard: PatScopeGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  function createMockContext(user: any): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new PatScopeGuard(reflector as unknown as Reflector);
  });

  it("allows access when no scopes are required", () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = createMockContext({ id: "user-1" });
    expect(guard.canActivate(context)).toBe(true);
  });

  it("allows access when required scopes list is empty", () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    const context = createMockContext({ id: "user-1" });
    expect(guard.canActivate(context)).toBe(true);
  });

  it("allows JWT-authenticated requests (no patScopes)", () => {
    reflector.getAllAndOverride.mockReturnValue(["write"]);
    const context = createMockContext({ id: "user-1" });
    expect(guard.canActivate(context)).toBe(true);
  });

  it("allows PAT with matching scope", () => {
    reflector.getAllAndOverride.mockReturnValue(["read"]);
    const context = createMockContext({
      id: "user-1",
      patScopes: "read,write",
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it("allows PAT with all required scopes", () => {
    reflector.getAllAndOverride.mockReturnValue(["read", "write"]);
    const context = createMockContext({
      id: "user-1",
      patScopes: "read,write,reports",
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it("rejects PAT missing required scope", () => {
    reflector.getAllAndOverride.mockReturnValue(["write"]);
    const context = createMockContext({ id: "user-1", patScopes: "read" });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it("rejects PAT missing one of multiple required scopes", () => {
    reflector.getAllAndOverride.mockReturnValue(["read", "write"]);
    const context = createMockContext({ id: "user-1", patScopes: "read" });
    expect(() => guard.canActivate(context)).toThrow(
      "Insufficient token scope",
    );
  });

  it("handles scopes with whitespace", () => {
    reflector.getAllAndOverride.mockReturnValue(["write"]);
    const context = createMockContext({
      id: "user-1",
      patScopes: "read, write",
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it("uses REQUIRE_SCOPE_KEY metadata key", () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = createMockContext({ id: "user-1" });
    guard.canActivate(context);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      REQUIRE_SCOPE_KEY,
      expect.any(Array),
    );
  });
});
