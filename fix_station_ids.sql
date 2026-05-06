-- SQL to ensure all tables have station_id and are consistent with the UI
-- Run this in Supabase SQL Editor

-- 1. Add station_id to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS station_id INTEGER REFERENCES stations(id) ON DELETE SET NULL;

-- 2. Ensure transactions table exists and has station_id
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL, -- revenue, expense, salary, advance, deduction, waste, purchase_payment
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'cash',
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  station_id INTEGER REFERENCES stations(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add station_id to products if missing
ALTER TABLE products ADD COLUMN IF NOT EXISTS station_id INTEGER REFERENCES stations(id) ON DELETE SET NULL;

-- 4. Add station_id to deals if missing
ALTER TABLE deals ADD COLUMN IF NOT EXISTS station_id INTEGER REFERENCES stations(id) ON DELETE SET NULL;

-- 5. Add station_id to payroll_records if you want to filter reports by station directly
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS station_id INTEGER REFERENCES stations(id) ON DELETE SET NULL;
