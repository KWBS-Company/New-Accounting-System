DO $$
DECLARE
    v_customer_id uuid := '95e7d03e-66d7-47a7-9c3f-86419b47c14e';
BEGIN

    -- =====================
    -- ROOT ACCOUNTS
    -- =====================
    INSERT INTO accounts (id, name, code, account_type, parent_id, customer_id) VALUES
    (gen_random_uuid(), 'Current Assets', '1000', 'ASSET', NULL, v_customer_id),
    (gen_random_uuid(), 'Fixed Assets', '1000', 'ASSET', NULL, v_customer_id),
    (gen_random_uuid(), 'Other Assets', '1000', 'ASSET', NULL, v_customer_id),
    (gen_random_uuid(), 'Current Liabilities', '2100', 'LIABILITY', NULL, v_customer_id),
    (gen_random_uuid(), 'Long-Term Liabilities', '2200', 'LIABILITY', NULL, v_customer_id),
    (gen_random_uuid(), 'Owner Capital', '3100', 'EQUITY', NULL, v_customer_id),
    (gen_random_uuid(), 'Retained Earnings', '3200', 'EQUITY', NULL, v_customer_id),
    (gen_random_uuid(), 'Operating Revenue', '4100', 'REVENUE', NULL, v_customer_id),
    (gen_random_uuid(), 'Other Revenue', '4100', 'REVENUE', NULL, v_customer_id),
    (gen_random_uuid(), 'Administrative Expenses', '5000', 'EXPENSE', NULL, v_customer_id),
    (gen_random_uuid(), 'Selling & Marketing Expenses', '6000', 'EXPENSE', NULL, v_customer_id),
    (gen_random_uuid(), 'Financial Expenses', '6000', 'EXPENSE', NULL, v_customer_id);

END $$;