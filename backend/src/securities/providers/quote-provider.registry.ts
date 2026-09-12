import { Injectable } from "@nestjs/common";
import { MsnFinanceService } from "../msn-finance.service";
import { YahooFinanceService } from "../yahoo-finance.service";
import { AmfiNavService } from "../amfi-nav.service";
import { Security } from "../entities/security.entity";
import { QuoteProvider, QuoteProviderName } from "./quote-provider.interface";

export const DEFAULT_QUOTE_PROVIDER: QuoteProviderName = "yahoo";

@Injectable()
export class QuoteProviderRegistry {
  constructor(
    private readonly yahoo: YahooFinanceService,
    private readonly msn: MsnFinanceService,
    private readonly amfi: AmfiNavService,
  ) {}

  getByName(name: QuoteProviderName): QuoteProvider {
    return name === "msn" ? this.msn : this.yahoo;
  }

  /** The AMFI NAV source, selected by instrument identity rather than preference. */
  getAmfi(): QuoteProvider {
    return this.amfi;
  }

  /**
   * The providers a user-selectable preference may name. AMFI is deliberately
   * absent: it is reachable only through `resolveForSecurity`, so it can never
   * be used as a fallback for an equity.
   */
  listAll(): QuoteProvider[] {
    return [this.yahoo, this.msn];
  }

  /**
   * Return providers in order [primary, fallback] for a security.
   *
   * A security carrying an AMFI scheme code is an Indian mutual fund, and AMFI
   * is the *only* provider that can price it: Yahoo and MSN have no listing for
   * a scheme number, so falling back to them would spend three round trips per
   * refresh to fail, and the `.NS` spelling of a numeric scheme code is not a
   * symbol anybody lists. So that instrument resolves to AMFI alone.
   *
   * Everything else is unchanged: primary = security override, else user
   * default, else "yahoo"; fallback = the other selectable provider.
   */
  resolveForSecurity(
    security: Pick<Security, "quoteProvider" | "amfiSchemeCode">,
    userDefault: QuoteProviderName | null | undefined,
  ): QuoteProvider[] {
    if ((security.amfiSchemeCode ?? "").trim() !== "") {
      return [this.amfi];
    }

    const primary: QuoteProviderName =
      (security.quoteProvider as QuoteProviderName | null) ??
      userDefault ??
      DEFAULT_QUOTE_PROVIDER;

    const providers: QuoteProvider[] = [this.getByName(primary)];
    for (const p of this.listAll()) {
      if (p.name !== primary) providers.push(p);
    }
    return providers;
  }
}
