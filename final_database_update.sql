-- FreshFood System - Final Schema Update (Run this in Supabase SQL Editor)
-- هذا الكود يقوم بتحديث قاعدة البيانات بكافة الحقول الجديدة التي أضفناها مؤخراً

-- 1. تحديث إعدادات الشركة ببيانات الهوية البصرية الجديدة والسجلات الرسمية
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS sidebar_logo_url TEXT,
ADD COLUMN IF NOT EXISTS announcement_text TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS header_layout TEXT DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS commercial_register TEXT,
ADD COLUMN IF NOT EXISTS export_register TEXT,
ADD COLUMN IF NOT EXISTS tax_card TEXT,
ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;

-- 2. تحديث جدول الموظفين لضمان وجود حقول التواصل الإضافية
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS alt_phone TEXT,
ADD COLUMN IF NOT EXISTS national_id TEXT,
ADD COLUMN IF NOT EXISTS join_date DATE DEFAULT CURRENT_DATE;

-- 3. تفعيل سجل النشاط (إذا لم يكن مفعلاً)
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  entity_id TEXT,
  details TEXT
);

-- 4. تفعيل التنبيهات (إذا لم تكن مفعلة)
CREATE TABLE IF NOT EXISTS system_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  target_roles TEXT[] DEFAULT '{admin,manager,hr}'::text[]
);

-- 5. تحديث صلاحيات الـ Storage (لضمان عمل رفع الصور)
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Insert" ON storage.objects;
DROP POLICY IF EXISTS "Public Update" ON storage.objects;

CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'company-assets');
CREATE POLICY "Public Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'company-assets');
CREATE POLICY "Public Update" ON storage.objects FOR UPDATE USING (bucket_id = 'company-assets');

-- ملاحظة: بعد تشغيل هذا الكود، سيختفي خطأ "schema cache" وتظهر الميزات الجديدة فوراً.
