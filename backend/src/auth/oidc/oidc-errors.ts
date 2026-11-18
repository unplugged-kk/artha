import { ConflictException } from "@nestjs/common";
import { tr } from "../../i18n/translate";

/**
 * An unknown sign-in identity carries the email of an existing account.
 *
 * Never merged automatically (D3): the owner signs in to that account and links
 * the provider from Settings, which proves control of the account rather than
 * of an inbox. The callback turns this into `error=account_exists`.
 */
export class OidcAccountExistsError extends ConflictException {
  constructor() {
    super({
      code: "OIDC_ACCOUNT_EXISTS",
      message: tr(
        "errors.auth.oidcAccountExists",
        "An account with this email already exists. Sign in to it and link this sign-in method in Settings.",
      ),
    });
  }
}
