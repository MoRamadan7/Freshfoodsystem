-- FreshFood System - Database Setup Script
-- نسخ هذا الكود بالكامل ولصقه في قسم SQL Editor في Supabase ثم الضغط على Run

-- 1. تحديث جدول company_settings
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS currency_symbol TEXT DEFAULT 'ج.م',
ADD COLUMN IF NOT EXISTS invoice_footer TEXT,
ADD COLUMN IF NOT EXISTS invoice_prefix TEXT DEFAULT 'INV-',
ADD COLUMN IF NOT EXISTS invoice_tax_rate NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS invoice_show_logo BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS invoice_show_tax BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS payroll_day INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS working_hours NUMERIC(4,2) DEFAULT 8,
ADD COLUMN IF NOT EXISTS late_penalty_per_hour NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_overtime_rate NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_overtime_rate NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS notify_low_stock BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_low_stock_days INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS notify_deals_closing BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_deals_closing_days INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS notify_overdue_invoices BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_birthdays BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_payroll BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS sidebar_logo_url TEXT,
ADD COLUMN IF NOT EXISTS announcement_text TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS header_layout TEXT DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS commercial_register TEXT,
ADD COLUMN IF NOT EXISTS export_register TEXT,
ADD COLUMN IF NOT EXISTS tax_card TEXT,
ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;

-- 2. تحديث جدول employees (لضمان وجود الرواتب والصلاحيات)
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS basic_salary NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS overtime_rate NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'employee',
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS facebook_url TEXT,
ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
ADD COLUMN IF NOT EXISTS instagram_url TEXT,
ADD COLUMN IF NOT EXISTS alt_phone TEXT;

-- 3. إنشاء جدول الفواتير (invoices)
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  deal_id INTEGER REFERENCES deals(id) ON DELETE SET NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','cancelled')),
  subtotal NUMERIC(12,2) DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_by INTEGER REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. إنشاء جدول بنود الفاتورة (invoice_items)
CREATE TABLE IF NOT EXISTS invoice_items (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10,3) DEFAULT 1,
  unit_price NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0
);

-- 5. إنشاء جدول كشف الرواتب (payroll_records)
CREATE TABLE IF NOT EXISTS payroll_records (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  basic_salary NUMERIC(12,2),
  attendance_days INTEGER DEFAULT 0,
  absence_days INTEGER DEFAULT 0,
  overtime_hours NUMERIC(6,2) DEFAULT 0,
  overtime_amount NUMERIC(12,2) DEFAULT 0,
  bonuses NUMERIC(12,2) DEFAULT 0,
  deductions NUMERIC(12,2) DEFAULT 0,
  advances NUMERIC(12,2) DEFAULT 0,
  net_salary NUMERIC(12,2),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','paid')),
  paid_at TIMESTAMPTZ,
  UNIQUE(employee_id, month, year)
);

-- 6. إنشاء مساحة تخزين (Bucket) لرفع لوجو الشركة
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

-- السماح للبرنامج برفع وقراءة الصور من المساحة
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Insert" ON storage.objects;
DROP POLICY IF EXISTS "Public Update" ON storage.objects;

CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'company-assets');
CREATE POLICY "Public Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'company-assets');
CREATE POLICY "Public Update" ON storage.objects FOR UPDATE USING (bucket_id = 'company-assets');

-- 7. تحديث لدعم الحقول المخصصة (Custom Fields) ولوجو العملاء والموردين
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS custom_fields_schema JSONB DEFAULT '{}'::jsonb;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS logo_url TEXT, ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS logo_url TEXT, ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

-- 8. إنشاء جدول سجل التحديثات (Activity Logs)
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL, -- 'إضافة', 'تعديل', 'حذف'
  entity_name TEXT NOT NULL, -- اسم القسم مثلا 'العملاء'
  entity_id TEXT, -- معرف العنصر المعدل
  details TEXT -- تفاصيل إضافية
);

-- 9. إنشاء جدول التنبيهات الإدارية (System Notifications)
CREATE TABLE IF NOT EXISTS system_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  type TEXT NOT NULL, -- 'registration', 'alert', 'system'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  target_roles TEXT[] DEFAULT '{admin,manager,hr}'::text[]
);
