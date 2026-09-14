-- Indian Merchant Reference Data (Priority 10)
--
-- Additive. Creates global reference data table `merchant_references` and
-- populates initial curated Indian merchants/billers for payee recognition
-- and normalization during bank statement ingestion.
--
-- Global reference data: no user_id column, RLS-exempt like currencies,
-- broker_import_layouts, and instrument_aliases.

CREATE TABLE IF NOT EXISTS merchant_references (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    canonical_name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,
    aliases TEXT[] NOT NULL DEFAULT '{}',
    category_suggestion VARCHAR(255),
    website VARCHAR(2048),
    country_code VARCHAR(2) NOT NULL DEFAULT 'IN',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_merchant_references_canonical
    ON merchant_references(canonical_name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_merchant_references_normalized
    ON merchant_references(normalized_name);

CREATE INDEX IF NOT EXISTS idx_merchant_references_country
    ON merchant_references(country_code);

-- Seed curated Indian merchants/billers idempotently
INSERT INTO merchant_references (canonical_name, normalized_name, aliases, category_suggestion, website, country_code)
VALUES
    ('Swiggy', 'SWIGGY', ARRAY['BUNDL TECHNOLOGIES*', 'SWIGGY *'], 'Food & Dining', 'https://www.swiggy.com', 'IN'),
    ('Zomato', 'ZOMATO', ARRAY['ZOMATO *', 'BLINKIT*', 'BLINK COMMERCE*'], 'Food & Dining', 'https://www.zomato.com', 'IN'),
    ('Amazon Pay India', 'AMAZON PAY INDIA', ARRAY['AMAZON PAY*', 'AMAZON SELLER SERVICES*', 'AMAZON RETAIL INDIA*', 'AMAZON INDIA*'], 'Shopping', 'https://www.amazon.in', 'IN'),
    ('Flipkart', 'FLIPKART', ARRAY['FLIPKART *', 'FLIPKART INTERNET*', 'FLIPKART PAYMENTS*'], 'Shopping', 'https://www.flipkart.com', 'IN'),
    ('Airtel', 'AIRTEL', ARRAY['BHARTI AIRTEL*', 'AIRTEL PAYMENTS*', 'AIRTEL BROADBAND*', 'AIRTEL DTH*', 'AIRTEL *'], 'Bills & Utilities', 'https://www.airtel.in', 'IN'),
    ('Jio', 'JIO', ARRAY['RELIANCE JIO*', 'JIO PREPAID*', 'JIO POSTPAID*', 'JIO FIBER*', 'JIO *'], 'Bills & Utilities', 'https://www.jio.com', 'IN'),
    ('ACT Fibernet', 'ACT FIBERNET', ARRAY['ATRIA CONVERGENCE*', 'ACT FIBERNET*', 'ACT BROADBAND*'], 'Bills & Utilities', 'https://www.actcorp.in', 'IN'),
    ('BESCOM', 'BESCOM', ARRAY['BANGALORE ELECTRICITY SUPPLY*', 'BESCOM *'], 'Bills & Utilities', 'https://bescom.karnataka.gov.in', 'IN'),
    ('Tata Power', 'TATA POWER', ARRAY['TATA POWER *', 'TPDDL*'], 'Bills & Utilities', 'https://www.tatapower.com', 'IN'),
    ('Uber', 'UBER', ARRAY['UBER INDIA*', 'UBER BV*', 'UBER TRIP*', 'UBER *'], 'Transportation', 'https://www.uber.com', 'IN'),
    ('Ola', 'OLA', ARRAY['ANI TECHNOLOGIES*', 'OLA CABS*', 'OLA MONEY*', 'OLA ELECTRIC*', 'OLA *'], 'Transportation', 'https://www.olacabs.com', 'IN'),
    ('IRCTC', 'IRCTC', ARRAY['INDIAN RAILWAY CATERING*', 'IRCTC *'], 'Travel', 'https://www.irctc.co.in', 'IN'),
    ('Zerodha', 'ZERODHA', ARRAY['ZERODHA BROKING*', 'ZERODHA *'], 'Investments', 'https://zerodha.com', 'IN'),
    ('Groww', 'GROWW', ARRAY['NEXTBILLION TECHNOLOGY*', 'GROWW *'], 'Investments', 'https://groww.in', 'IN')
ON CONFLICT (normalized_name) DO NOTHING;
