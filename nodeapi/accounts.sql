DO $$
DECLARE
    v_customer_id uuid := '95e7d03e-66d7-47a7-9c3f-86419b47c14e';
BEGIN

    -- =====================
    -- ROOT ACCOUNTS
    -- =====================
    INSERT INTO accounts (id, name, code, account_type, parent_id, customer_id) VALUES
    (gen_random_uuid(), 'Current Assets', 'CA0001', 'ASSET', NULL, v_customer_id),
    (gen_random_uuid(), 'Fixed Assets', 'FA0001', 'ASSET', NULL, v_customer_id),
    (gen_random_uuid(), 'Other Assets', 'OA0001', 'ASSET', NULL, v_customer_id),
    (gen_random_uuid(), 'Current Liabilities', 'CL0001', 'LIABILITY', NULL, v_customer_id),
    (gen_random_uuid(), 'Long-Term Liabilities', 'LTL0001', 'LIABILITY', NULL, v_customer_id),
    (gen_random_uuid(), 'Owner Capital', 'OC0001', 'EQUITY', NULL, v_customer_id),
    (gen_random_uuid(), 'Retained Earnings(Last year Profit)', 'RE0001', 'EQUITY', NULL, v_customer_id),
    (gen_random_uuid(), 'General Reserve', 'GR0001', 'EQUITY', NULL, v_customer_id),
    (gen_random_uuid(), 'Common Stock', 'CS0001', 'EQUITY', NULL, v_customer_id),
    (gen_random_uuid(), 'Treasury Stock', 'TS0001', 'EQUITY', NULL, v_customer_id),
    (gen_random_uuid(), 'Revenue Accounts', 'RA0001', 'REVENUE', NULL, v_customer_id),
    (gen_random_uuid(), 'Expense Accounts', 'EA0001', 'EXPENSE', NULL, v_customer_id);

END $$;