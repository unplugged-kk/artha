/**
 * Curated reference data for common Indian merchants and billers.
 *
 * Provides canonical merchant identities and statement alias patterns
 * to improve payee recognition and normalization during statement imports.
 *
 * Deliberately pure reference data:
 * - Category suggestions are optional descriptive metadata and are NOT automatically
 *   assigned to imported transactions (preserving unresolved Open Decision 2).
 * - Aliases use glob pattern matching. Word-boundary patterns like 'OLA *' prevent
 *   false positives on distinct entities such as 'Olam International'.
 */

export interface IndianMerchantSeed {
  canonicalName: string;
  normalizedName: string;
  aliases: string[];
  categorySuggestion?: string;
  website?: string;
  countryCode: string;
}

export const INDIAN_MERCHANT_SEEDS: readonly IndianMerchantSeed[] = [
  {
    canonicalName: "Swiggy",
    normalizedName: "SWIGGY",
    aliases: ["BUNDL TECHNOLOGIES*", "SWIGGY *"],
    categorySuggestion: "Food & Dining",
    website: "https://www.swiggy.com",
    countryCode: "IN",
  },
  {
    canonicalName: "Zomato",
    normalizedName: "ZOMATO",
    aliases: ["ZOMATO *", "BLINKIT*", "BLINK COMMERCE*"],
    categorySuggestion: "Food & Dining",
    website: "https://www.zomato.com",
    countryCode: "IN",
  },
  {
    canonicalName: "Amazon Pay India",
    normalizedName: "AMAZON PAY INDIA",
    aliases: [
      "AMAZON PAY*",
      "AMAZON SELLER SERVICES*",
      "AMAZON RETAIL INDIA*",
      "AMAZON INDIA*",
    ],
    categorySuggestion: "Shopping",
    website: "https://www.amazon.in",
    countryCode: "IN",
  },
  {
    canonicalName: "Flipkart",
    normalizedName: "FLIPKART",
    aliases: ["FLIPKART *", "FLIPKART INTERNET*", "FLIPKART PAYMENTS*"],
    categorySuggestion: "Shopping",
    website: "https://www.flipkart.com",
    countryCode: "IN",
  },
  {
    canonicalName: "Airtel",
    normalizedName: "AIRTEL",
    aliases: [
      "BHARTI AIRTEL*",
      "AIRTEL PAYMENTS*",
      "AIRTEL BROADBAND*",
      "AIRTEL DTH*",
      "AIRTEL *",
    ],
    categorySuggestion: "Bills & Utilities",
    website: "https://www.airtel.in",
    countryCode: "IN",
  },
  {
    canonicalName: "Jio",
    normalizedName: "JIO",
    aliases: [
      "RELIANCE JIO*",
      "JIO PREPAID*",
      "JIO POSTPAID*",
      "JIO FIBER*",
      "JIO *",
    ],
    categorySuggestion: "Bills & Utilities",
    website: "https://www.jio.com",
    countryCode: "IN",
  },
  {
    canonicalName: "ACT Fibernet",
    normalizedName: "ACT FIBERNET",
    aliases: ["ATRIA CONVERGENCE*", "ACT FIBERNET*", "ACT BROADBAND*"],
    categorySuggestion: "Bills & Utilities",
    website: "https://www.actcorp.in",
    countryCode: "IN",
  },
  {
    canonicalName: "BESCOM",
    normalizedName: "BESCOM",
    aliases: ["BANGALORE ELECTRICITY SUPPLY*", "BESCOM *"],
    categorySuggestion: "Bills & Utilities",
    website: "https://bescom.karnataka.gov.in",
    countryCode: "IN",
  },
  {
    canonicalName: "Tata Power",
    normalizedName: "TATA POWER",
    aliases: ["TATA POWER *", "TPDDL*"],
    categorySuggestion: "Bills & Utilities",
    website: "https://www.tatapower.com",
    countryCode: "IN",
  },
  {
    canonicalName: "Uber",
    normalizedName: "UBER",
    aliases: ["UBER INDIA*", "UBER BV*", "UBER TRIP*", "UBER *"],
    categorySuggestion: "Transportation",
    website: "https://www.uber.com",
    countryCode: "IN",
  },
  {
    canonicalName: "Ola",
    normalizedName: "OLA",
    aliases: [
      "ANI TECHNOLOGIES*",
      "OLA CABS*",
      "OLA MONEY*",
      "OLA ELECTRIC*",
      "OLA *",
    ],
    categorySuggestion: "Transportation",
    website: "https://www.olacabs.com",
    countryCode: "IN",
  },
  {
    canonicalName: "IRCTC",
    normalizedName: "IRCTC",
    aliases: ["INDIAN RAILWAY CATERING*", "IRCTC *"],
    categorySuggestion: "Travel",
    website: "https://www.irctc.co.in",
    countryCode: "IN",
  },
  {
    canonicalName: "Zerodha",
    normalizedName: "ZERODHA",
    aliases: ["ZERODHA BROKING*", "ZERODHA *"],
    categorySuggestion: "Investments",
    website: "https://zerodha.com",
    countryCode: "IN",
  },
  {
    canonicalName: "Groww",
    normalizedName: "GROWW",
    aliases: ["NEXTBILLION TECHNOLOGY*", "GROWW *"],
    categorySuggestion: "Investments",
    website: "https://groww.in",
    countryCode: "IN",
  },
];
