import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Request,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Response } from "express";
import { DemoRestricted } from "../../common/decorators/demo-restricted.decorator";
import { rateLimit } from "../../common/throttle.util";
import { tr } from "../../i18n/translate";
import { SkipPasswordCheck } from "../decorators/skip-password-check.decorator";
import {
  OidcReauthService,
  OIDC_REAUTH_PENDING_TTL_SECONDS,
} from "../oidc/oidc-reauth.service";
import { OidcService } from "../oidc/oidc.service";
import { RequireStepUp } from "../step-up/require-step-up.decorator";
import { StepUpGuard } from "../step-up/step-up.guard";
import { IdentitiesService, IdentitySummary } from "./identities.service";

/**
 * The account's external sign-in methods (D4). Not @AllowDelegate: a delegate
 * acting for an owner never sees or changes the owner's ways in.
 */
@ApiTags("Authentication")
@Controller("auth/identities")
@UseGuards(AuthGuard("jwt"))
@SkipPasswordCheck()
@ApiBearerAuth()
export class IdentitiesController {
  private readonly useSecureCookies: boolean;

  constructor(
    private readonly identitiesService: IdentitiesService,
    private readonly oidcService: OidcService,
    private readonly oidcReauthService: OidcReauthService,
    configService: ConfigService,
  ) {
    const disableHttpsHeaders =
      configService
        .get<string>("DISABLE_HTTPS_HEADERS", "false")
        .toLowerCase() === "true";
    this.useSecureCookies =
      configService.get<string>("NODE_ENV") === "production" &&
      !disableHttpsHeaders;
  }

  @Get()
  @ApiOperation({
    summary: "List the external sign-in methods linked to this account",
  })
  list(@Request() req): Promise<IdentitySummary[]> {
    return this.identitiesService.list(req.user.id);
  }

  /**
   * Start linking another sign-in method. Needs a fresh step-up -- the
   * password (or TOTP) for a local account, an OIDC re-authentication for an
   * SSO one -- because a link is a new permanent way into the account.
   *
   * Returns the provider URL rather than redirecting, since the SPA calls this
   * with the step-up header and then navigates. The OIDC callback attaches the
   * identity the provider returns and reports `?link=<outcome>`.
   */
  @Post("link")
  @UseGuards(StepUpGuard)
  @RequireStepUp("manage-identities")
  @DemoRestricted()
  @Throttle({ default: { ttl: 900000, limit: rateLimit(10) } })
  @ApiOperation({ summary: "Start linking a sign-in method to this account" })
  startLink(
    @Request() req,
    @Res({ passthrough: true }) res: Response,
  ): { url: string } {
    if (!this.oidcService.enabled) {
      throw new BadRequestException(
        tr(
          "errors.auth.oidcNotConfigured",
          "OIDC authentication is not configured",
        ),
      );
    }
    const state = this.oidcService.generateState();
    const nonce = this.oidcService.generateNonce();
    const codeVerifier = this.oidcService.generateCodeVerifier();
    const cookieOptions = {
      httpOnly: true,
      secure: this.useSecureCookies,
      sameSite: "lax" as const,
      maxAge: OIDC_REAUTH_PENDING_TTL_SECONDS * 1000,
    };
    res.cookie("oidc_state", state, cookieOptions);
    res.cookie("oidc_nonce", nonce, cookieOptions);
    res.cookie("oidc_code_verifier", codeVerifier, cookieOptions);
    res.cookie(
      "oidc_link",
      this.oidcReauthService.createLinkMarker(req.user.id, state),
      cookieOptions,
    );
    res.clearCookie("oidc_reauth", {
      httpOnly: true,
      secure: this.useSecureCookies,
      sameSite: "lax" as const,
    });
    // prompt=login: the user is already signed in at the provider with the
    // identity they use today, and has to be able to choose another.
    return {
      url: this.oidcService.getAuthorizationUrl(state, nonce, codeVerifier, {
        forceReauthentication: true,
      }),
    };
  }

  @Delete(":id")
  @UseGuards(StepUpGuard)
  @RequireStepUp("manage-identities")
  @DemoRestricted()
  @ApiOperation({ summary: "Remove a linked sign-in method" })
  async unlink(
    @Request() req,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    await this.identitiesService.unlink(req.user.id, id);
    return { message: "Sign-in method removed" };
  }
}
