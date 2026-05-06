-- =============================================================
-- FreshFood System - MASTER SETUP SQL
-- نسخ هذا الكود كاملاً ولصقه في SQL Editor في Supabase ثم Run
-- يُصلح كل شيء دفعة واحدة
-- =============================================================

-- ════════════════════════════════════════════
-- 0. TRANSACTIONS: إضافة نوع commission
-- ════════════════════════════════════════════
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('revenue','expense','salary','advance','deduction','waste','purchase_payment','commission'));

-- ════════════════════════════════════════════
-- 1. COMPANY SETTINGS: كل الأعمدة المطلوبة
-- ════════════════════════════════════════════
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS currency_symbol     TEXT    DEFAULT 'ج.م',
  ADD COLUMN IF NOT EXISTS invoice_footer      TEXT,
  ADD COLUMN IF NOT EXISTS invoice_prefix      TEXT    DEFAULT 'INV-',
  ADD COLUMN IF NOT EXISTS invoice_tax_rate    NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoice_show_logo   BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS invoice_show_tax    BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS invoice_color       TEXT    DEFAULT '#10b981',
  ADD COLUMN IF NOT EXISTS invoice_notes       TEXT,
  ADD COLUMN IF NOT EXISTS payroll_day         INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS working_hours       NUMERIC(4,2) DEFAULT 8,
  ADD COLUMN IF NOT EXISTS late_penalty_per_hour NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_overtime_rate   NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_overtime_rate NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notify_low_stock      BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_low_stock_days INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS notify_deals_closing       BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_deals_closing_days  INTEGER DEFAULT 7,
  ADD COLUMN IF NOT EXISTS notify_overdue_invoices    BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_birthdays           BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_payroll             BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS sidebar_logo_url    TEXT,
  ADD COLUMN IF NOT EXISTS announcement_text   TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS header_layout       TEXT    DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS commercial_register TEXT,
  ADD COLUMN IF NOT EXISTS export_register     TEXT,
  ADD COLUMN IF NOT EXISTS tax_card            TEXT,
  ADD COLUMN IF NOT EXISTS gemini_api_key      TEXT,
  ADD COLUMN IF NOT EXISTS custom_fields_schema JSONB  DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS stamp_url           TEXT,
  ADD COLUMN IF NOT EXISTS watermark_url       TEXT,
  ADD COLUMN IF NOT EXISTS language            TEXT    DEFAULT 'ar',
  ADD COLUMN IF NOT EXISTS currency            TEXT    DEFAULT 'EGP';

-- ════════════════════════════════════════════
-- 2. EMPLOYEES: كل الأعمدة المطلوبة
-- ════════════════════════════════════════════
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS basic_salary    NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_rate   NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS role            TEXT DEFAULT 'employee',
  ADD COLUMN IF NOT EXISTS avatar_url      TEXT,
  ADD COLUMN IF NOT EXISTS facebook_url    TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url    TEXT,
  ADD COLUMN IF NOT EXISTS instagram_url   TEXT,
  ADD COLUMN IF NOT EXISTS alt_phone       TEXT,
  ADD COLUMN IF NOT EXISTS national_id     TEXT,
  ADD COLUMN IF NOT EXISTS custom_fields   JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_active       BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS employee_type   TEXT DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS daily_rate      NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 0;

-- ════════════════════════════════════════════
-- 3. CLIENTS: أعمدة الخصوصية
-- ════════════════════════════════════════════
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS assigned_sales_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS logo_url         TEXT,
  ADD COLUMN IF NOT EXISTS custom_fields    JSONB DEFAULT '{}'::jsonb;

-- ════════════════════════════════════════════
-- 4. SUPPLIERS
-- ════════════════════════════════════════════
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS logo_url         TEXT,
  ADD COLUMN IF NOT EXISTS custom_fields    JSONB DEFAULT '{}'::jsonb;

-- ════════════════════════════════════════════
-- 5. DEALS
-- ════════════════════════════════════════════
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS custom_fields    JSONB DEFAULT '{}'::jsonb;

-- ════════════════════════════════════════════
-- 6. PRODUCTS
-- ════════════════════════════════════════════
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS custom_fields    JSONB DEFAULT '{}'::jsonb;

-- ════════════════════════════════════════════
-- 7. INVOICES: أعمدة إضافية
-- ════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS invoices (
  id             SERIAL PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  client_id      INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  deal_id        INTEGER REFERENCES deals(id)   ON DELETE SET NULL,
  issue_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date       DATE,
  status         TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','cancelled')),
  subtotal       NUMERIC(12,2) DEFAULT 0,
  tax_rate       NUMERIC(5,2)  DEFAULT 0,
  tax_amount     NUMERIC(12,2) DEFAULT 0,
  total          NUMERIC(12,2) DEFAULT 0,
  notes          TEXT,
  created_by     INTEGER REFERENCES employees(id),
  station_id     INTEGER,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS station_id  INTEGER,
  ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS invoice_items (
  id          SERIAL PRIMARY KEY,
  invoice_id  INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity    NUMERIC(10,3) DEFAULT 1,
  unit_price  NUMERIC(12,2) DEFAULT 0,
  total       NUMERIC(12,2) DEFAULT 0
);

-- ════════════════════════════════════════════
-- 8. PAYROLL RECORDS
-- ════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS payroll_records (
  id              SERIAL PRIMARY KEY,
  employee_id     INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  month           INTEGER NOT NULL,
  year            INTEGER NOT NULL,
  basic_salary    NUMERIC(12,2),
  attendance_days INTEGER DEFAULT 0,
  absence_days    INTEGER DEFAULT 0,
  overtime_hours  NUMERIC(6,2) DEFAULT 0,
  overtime_amount NUMERIC(12,2) DEFAULT 0,
  bonuses         NUMERIC(12,2) DEFAULT 0,
  deductions      NUMERIC(12,2) DEFAULT 0,
  advances        NUMERIC(12,2) DEFAULT 0,
  commission      NUMERIC(12,2) DEFAULT 0,
  net_salary      NUMERIC(12,2),
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft','paid')),
  paid_at         TIMESTAMPTZ,
  UNIQUE(employee_id, month, year)
);

ALTER TABLE payroll_records
  ADD COLUMN IF NOT EXISTS commission NUMERIC(12,2) DEFAULT 0;

-- ════════════════════════════════════════════
-- 9. ACTIVITY LOGS
-- ════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS activity_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  entity_id   TEXT,
  details     TEXT
);

-- ════════════════════════════════════════════
-- 10. SYSTEM NOTIFICATIONS
-- ════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS system_notifications (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  type         TEXT NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  is_read      BOOLEAN DEFAULT false,
  target_roles TEXT[] DEFAULT '{admin,manager,hr}'::text[]
);

-- ════════════════════════════════════════════
-- 11. STORAGE BUCKET
-- ════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Access"  ON storage.objects;
DROP POLICY IF EXISTS "Public Insert"  ON storage.objects;
DROP POLICY IF EXISTS "Public Update"  ON storage.objects;
DROP POLICY IF EXISTS "Public Delete"  ON storage.objects;

CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'company-assets');
CREATE POLICY "Public Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'company-assets');
CREATE POLICY "Public Update" ON storage.objects FOR UPDATE USING (bucket_id = 'company-assets');
CREATE POLICY "Public Delete" ON storage.objects FOR DELETE USING (bucket_id = 'company-assets');

-- ════════════════════════════════════════════
-- 12. AUTOMATION TRIGGER
-- ════════════════════════════════════════════
CREATE OR REPLACE FUNCTION handle_deal_completion()
RETURNS TRIGGER AS $$
DECLARE
    v_invoice_id  INTEGER;
    v_invoice_num TEXT;
    v_prefix      TEXT;
BEGIN
    IF (NEW.status IN ('contracted', 'won') AND
        (OLD.status IS NULL OR OLD.status NOT IN ('contracted', 'won'))) THEN

        -- أ. خصم المخزون
        IF NEW.product_id IS NOT NULL AND NEW.quantity > 0 THEN
            UPDATE products
            SET stock_quantity = GREATEST(0, stock_quantity - NEW.quantity)
            WHERE id = NEW.product_id;
        END IF;

        -- ب. إيراد في الخزنة
        INSERT INTO transactions (date, type, amount, client_id, employee_id, station_id, notes)
        VALUES (CURRENT_DATE, 'revenue', NEW.total_amount, NEW.client_id, NEW.employee_id, NEW.station_id,
                'ناتج عن إتمام صفقة رقم: ' || NEW.id);

        -- ج. عمولة السيلز
        IF NEW.commission_rate > 0 AND NEW.employee_id IS NOT NULL THEN
            INSERT INTO transactions (date, type, amount, employee_id, station_id, notes)
            VALUES (CURRENT_DATE, 'commission',
                    ROUND((NEW.total_amount * NEW.commission_rate / 100)::NUMERIC, 2),
                    NEW.employee_id, NEW.station_id,
                    'عمولة ' || NEW.commission_rate || '% على صفقة رقم: ' || NEW.id);
        END IF;

        -- د. إنشاء الفاتورة
        SELECT COALESCE(invoice_prefix, 'INV-') INTO v_prefix FROM company_settings LIMIT 1;
        v_invoice_num := v_prefix || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || NEW.id;

        INSERT INTO invoices (invoice_number, client_id, deal_id, issue_date, status,
                              subtotal, total, tax_rate, tax_amount, created_by, station_id, notes)
        VALUES (v_invoice_num, NEW.client_id, NEW.id, CURRENT_DATE, 'paid',
                NEW.total_amount, NEW.total_amount, 0, 0, NEW.employee_id, NEW.station_id,
                'فاتورة آلية - صفقة رقم: ' || NEW.id)
        RETURNING id INTO v_invoice_id;

        INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total)
        VALUES (v_invoice_id,
                COALESCE((SELECT product_name FROM products WHERE id = NEW.product_id), 'منتج') ||
                CASE WHEN NEW.unit IS NOT NULL THEN ' (' || NEW.unit || ')' ELSE '' END,
                NEW.quantity,
                CASE WHEN NEW.quantity > 0 THEN ROUND((NEW.total_amount / NEW.quantity)::NUMERIC, 2) ELSE 0 END,
                NEW.total_amount);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_deal_status_change ON deals;
CREATE TRIGGER on_deal_status_change
AFTER UPDATE ON deals
FOR EACH ROW EXECUTE FUNCTION handle_deal_completion();

-- ════════════════════════════════════════════
-- 13. تحقق نهائي
-- ════════════════════════════════════════════
SELECT 'MASTER SETUP COMPLETE ✅' AS status;
