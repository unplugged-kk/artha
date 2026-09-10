import { REQUIRE_SCOPE_KEY, RequireScope } from "./require-scope.decorator";

describe("RequireScope decorator", () => {
  it("sets metadata with the correct key and scopes", () => {
    @RequireScope("read", "write")
    class TestController {}

    const metadata = Reflect.getMetadata(REQUIRE_SCOPE_KEY, TestController);
    expect(metadata).toEqual(["read", "write"]);
  });

  it("handles single scope", () => {
    @RequireScope("reports")
    class TestController {}

    const metadata = Reflect.getMetadata(REQUIRE_SCOPE_KEY, TestController);
    expect(metadata).toEqual(["reports"]);
  });

  it("handles empty scopes", () => {
    @RequireScope()
    class TestController {}

    const metadata = Reflect.getMetadata(REQUIRE_SCOPE_KEY, TestController);
    expect(metadata).toEqual([]);
  });
});
