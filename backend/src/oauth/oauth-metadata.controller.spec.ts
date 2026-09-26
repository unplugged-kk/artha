import { OAuthMetadataController } from "./oauth-metadata.controller";
import { OAuthProviderService } from "./oauth-provider.service";

describe("OAuthMetadataController", () => {
  let controller: OAuthMetadataController;
  let providerService: jest.Mocked<OAuthProviderService>;

  beforeEach(() => {
    providerService = {
      getMcpResourceUrl: jest
        .fn()
        .mockReturnValue("https://app.artha.test/api/v1/mcp"),
      getIssuerUrl: jest.fn().mockReturnValue("https://app.artha.test"),
    } as unknown as jest.Mocked<OAuthProviderService>;

    controller = new OAuthMetadataController(providerService);
  });

  it("publishes the MCP resource and the authorization server URL", () => {
    const meta = controller.protectedResource();

    expect(meta.resource).toBe("https://app.artha.test/api/v1/mcp");
    expect(meta.authorization_servers).toEqual(["https://app.artha.test"]);
    expect(meta.bearer_methods_supported).toEqual(["header"]);
    expect(meta.scopes_supported).toEqual(
      expect.arrayContaining(["artha:read", "artha:write"]),
    );
  });
});
