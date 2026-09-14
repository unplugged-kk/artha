import {
  matchMerchantReference,
  matchesAliasPattern,
  stripRailPrefix,
} from "./merchant-matcher.util";

describe("merchant-matcher.util", () => {
  describe("matchesAliasPattern", () => {
    it("matches exact strings case-insensitively", () => {
      expect(matchesAliasPattern("Swiggy", "swiggy")).toBe(true);
      expect(matchesAliasPattern("SWIGGY", "Swiggy")).toBe(true);
      expect(matchesAliasPattern("Zomato", "Swiggy")).toBe(false);
    });

    it("matches wildcard patterns", () => {
      expect(
        matchesAliasPattern(
          "BUNDL TECHNOLOGIES PVT LTD",
          "BUNDL TECHNOLOGIES*",
        ),
      ).toBe(true);
      expect(matchesAliasPattern("SWIGGY BANGALORE 560001", "SWIGGY*")).toBe(
        true,
      );
      expect(matchesAliasPattern("SWIGGY", "SWIGGY*")).toBe(true);
      expect(matchesAliasPattern("NOT SWIGGY", "SWIGGY*")).toBe(false);
    });

    it("handles multiple wildcards safely", () => {
      expect(
        matchesAliasPattern("AMAZON PAY INDIA PVT LTD", "*PAY*INDIA*"),
      ).toBe(true);
      expect(matchesAliasPattern("AMAZON RETAIL", "*PAY*INDIA*")).toBe(false);
    });

    it("handles empty or degenerate patterns", () => {
      expect(matchesAliasPattern("", "SWIGGY*")).toBe(false);
      expect(matchesAliasPattern("SWIGGY", "")).toBe(false);
    });
  });

  describe("stripRailPrefix", () => {
    it("strips common bank rail prefixes", () => {
      expect(stripRailPrefix("UPI SWIGGY")).toBe("SWIGGY");
      expect(stripRailPrefix("IMPS JIO")).toBe("JIO");
      expect(stripRailPrefix("NEFT AIRTEL")).toBe("AIRTEL");
      expect(stripRailPrefix("RTGS TATA POWER")).toBe("TATA POWER");
      expect(stripRailPrefix("POS FLIPKART")).toBe("FLIPKART");
      expect(stripRailPrefix("ACH BESCOM")).toBe("BESCOM");
      expect(stripRailPrefix("INB ZERODHA")).toBe("ZERODHA");
    });

    it("preserves non-rail strings", () => {
      expect(stripRailPrefix("SWIGGY BANGALORE")).toBe("SWIGGY BANGALORE");
      expect(stripRailPrefix("UBER TRIP")).toBe("UBER TRIP");
    });
  });

  describe("matchMerchantReference", () => {
    describe("canonical merchant matching", () => {
      it("matches canonical names directly", () => {
        expect(matchMerchantReference("Swiggy")?.canonicalName).toBe("Swiggy");
        expect(matchMerchantReference("Zomato")?.canonicalName).toBe("Zomato");
        expect(matchMerchantReference("Flipkart")?.canonicalName).toBe(
          "Flipkart",
        );
        expect(matchMerchantReference("Airtel")?.canonicalName).toBe("Airtel");
        expect(matchMerchantReference("Jio")?.canonicalName).toBe("Jio");
        expect(matchMerchantReference("BESCOM")?.canonicalName).toBe("BESCOM");
        expect(matchMerchantReference("ACT Fibernet")?.canonicalName).toBe(
          "ACT Fibernet",
        );
        expect(matchMerchantReference("Uber")?.canonicalName).toBe("Uber");
        expect(matchMerchantReference("Ola")?.canonicalName).toBe("Ola");
        expect(matchMerchantReference("IRCTC")?.canonicalName).toBe("IRCTC");
        expect(matchMerchantReference("Zerodha")?.canonicalName).toBe(
          "Zerodha",
        );
        expect(matchMerchantReference("Groww")?.canonicalName).toBe("Groww");
      });
    });

    describe("Indian corporate entity / alias matching", () => {
      it("resolves Swiggy from Bundl Technologies", () => {
        const match = matchMerchantReference("Bundl Technologies Pvt Ltd");
        expect(match?.canonicalName).toBe("Swiggy");
        expect(match?.website).toBe("https://www.swiggy.com");
      });

      it("resolves Ola from ANI Technologies", () => {
        const match = matchMerchantReference(
          "ANI TECHNOLOGIES PRIVATE LIMITED",
        );
        expect(match?.canonicalName).toBe("Ola");
        expect(match?.website).toBe("https://www.olacabs.com");
      });

      it("resolves ACT Fibernet from Atria Convergence Technologies", () => {
        const match = matchMerchantReference(
          "Atria Convergence Technologies Ltd",
        );
        expect(match?.canonicalName).toBe("ACT Fibernet");
      });

      it("resolves BESCOM from Bangalore Electricity Supply", () => {
        const match = matchMerchantReference(
          "Bangalore Electricity Supply Company Limited",
        );
        expect(match?.canonicalName).toBe("BESCOM");
      });

      it("resolves Groww from Nextbillion Technology", () => {
        const match = matchMerchantReference("Nextbillion Technology Pvt Ltd");
        expect(match?.canonicalName).toBe("Groww");
      });

      it("resolves Zomato from Blinkit / Blink Commerce", () => {
        expect(
          matchMerchantReference("Blinkit Commerce Pvt Ltd")?.canonicalName,
        ).toBe("Zomato");
        expect(
          matchMerchantReference("Blink Commerce Private Limited")
            ?.canonicalName,
        ).toBe("Zomato");
      });

      it("resolves Airtel from Bharti Airtel", () => {
        expect(
          matchMerchantReference("Bharti Airtel Limited")?.canonicalName,
        ).toBe("Airtel");
        expect(
          matchMerchantReference("Airtel Payments Bank")?.canonicalName,
        ).toBe("Airtel");
      });

      it("resolves Jio from Reliance Jio Infocomm", () => {
        expect(
          matchMerchantReference("Reliance Jio Infocomm Limited")
            ?.canonicalName,
        ).toBe("Jio");
        expect(
          matchMerchantReference("Jio Fiber Broadband")?.canonicalName,
        ).toBe("Jio");
      });

      it("resolves Amazon Pay India from seller services and retail entities", () => {
        expect(
          matchMerchantReference("Amazon Seller Services Pvt Ltd")
            ?.canonicalName,
        ).toBe("Amazon Pay India");
        expect(
          matchMerchantReference("Amazon Retail India Pvt Ltd")?.canonicalName,
        ).toBe("Amazon Pay India");
        expect(
          matchMerchantReference("Amazon Pay India Private Limited")
            ?.canonicalName,
        ).toBe("Amazon Pay India");
      });

      it("resolves Uber from Uber India Systems and Uber BV", () => {
        expect(
          matchMerchantReference("Uber India Systems Pvt Ltd")?.canonicalName,
        ).toBe("Uber");
        expect(matchMerchantReference("Uber BV")?.canonicalName).toBe("Uber");
      });
    });

    describe("legal-form stripping and normalization", () => {
      it("matches across various Indian corporate suffixes", () => {
        expect(matchMerchantReference("SWIGGY PVT LTD")?.canonicalName).toBe(
          "Swiggy",
        );
        expect(
          matchMerchantReference("SWIGGY PRIVATE LIMITED")?.canonicalName,
        ).toBe("Swiggy");
        expect(matchMerchantReference("SWIGGY LTD")?.canonicalName).toBe(
          "Swiggy",
        );
        expect(matchMerchantReference("SWIGGY LLP")?.canonicalName).toBe(
          "Swiggy",
        );
        expect(matchMerchantReference("SWIGGY OPC")?.canonicalName).toBe(
          "Swiggy",
        );
      });

      it("matches across case variations", () => {
        expect(matchMerchantReference("swiggy")?.canonicalName).toBe("Swiggy");
        expect(matchMerchantReference("SWIGGY")?.canonicalName).toBe("Swiggy");
        expect(matchMerchantReference("SwIgGy")?.canonicalName).toBe("Swiggy");
      });

      it("matches across spacing and punctuation variations", () => {
        expect(
          matchMerchantReference("Swiggy - Bangalore #1024")?.canonicalName,
        ).toBe("Swiggy");
        expect(
          matchMerchantReference("Zomato / Order 98124")?.canonicalName,
        ).toBe("Zomato");
        expect(
          matchMerchantReference("Uber   Trip -- Mumbai")?.canonicalName,
        ).toBe("Uber");
      });
    });

    describe("payment rail prefix handling", () => {
      it("identifies merchants with leading payment rails in statement narrations", () => {
        expect(
          matchMerchantReference("UPI/SWIGGY/425189201928")?.canonicalName,
        ).toBe("Swiggy");
        expect(matchMerchantReference("POS 4081 SWIGGY")?.canonicalName).toBe(
          "Swiggy",
        );
        expect(matchMerchantReference("NEFT-AIRTEL-98123")?.canonicalName).toBe(
          "Airtel",
        );
        expect(matchMerchantReference("IMPS-JIO-RECHARGE")?.canonicalName).toBe(
          "Jio",
        );
        expect(matchMerchantReference("ACH-BESCOM-BLR")?.canonicalName).toBe(
          "BESCOM",
        );
      });
    });

    describe("legitimate merchant distinctions (preventing false positive merges)", () => {
      it("does not match Tata Motors or Tata Steel to Tata Power", () => {
        expect(matchMerchantReference("Tata Motors Limited")).toBeNull();
        expect(matchMerchantReference("Tata Steel Ltd")).toBeNull();
        expect(
          matchMerchantReference("Tata Power Company Limited")?.canonicalName,
        ).toBe("Tata Power");
      });

      it("does not match Action Construction Equipment to ACT Fibernet", () => {
        expect(
          matchMerchantReference("Action Construction Equipment Ltd"),
        ).toBeNull();
        expect(
          matchMerchantReference("ACT Fibernet Bangalore")?.canonicalName,
        ).toBe("ACT Fibernet");
      });

      it("does not match Reliance Retail or Reliance Power to Jio", () => {
        expect(matchMerchantReference("Reliance Retail Limited")).toBeNull();
        expect(matchMerchantReference("Reliance Power Ltd")).toBeNull();
        expect(
          matchMerchantReference("Reliance Jio Infocomm Ltd")?.canonicalName,
        ).toBe("Jio");
      });

      it("does not match unrelated merchants with partial prefix overlap", () => {
        expect(matchMerchantReference("Swiss Air")).toBeNull();
        expect(matchMerchantReference("Ubisoft Entertainment")).toBeNull();
        expect(matchMerchantReference("Olam International")).toBeNull();
        expect(matchMerchantReference("Zoho Corporation")).toBeNull();
      });
    });

    describe("unmatched and degenerate inputs", () => {
      it("returns null for unrecognized merchants", () => {
        expect(matchMerchantReference("Corner Kirana Store")).toBeNull();
        expect(matchMerchantReference("Sharma Sweets")).toBeNull();
        expect(matchMerchantReference("Apex Technologies")).toBeNull();
      });

      it("returns null for empty or whitespace strings", () => {
        expect(matchMerchantReference("")).toBeNull();
        expect(matchMerchantReference("   ")).toBeNull();
        expect(matchMerchantReference("123456")).toBeNull();
      });
    });
  });
});
