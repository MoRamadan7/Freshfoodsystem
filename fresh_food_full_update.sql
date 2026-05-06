-- =============================================================
-- FRESH FOOD ERP - Full Update SQL
-- شغّل هذا الملف كاملاً في Supabase SQL Editor
-- =============================================================

-- ══════════════════════════════════════════════════════════
-- 1. إصلاح Foreign Key مشكلة حذف الموظف
--    (كان بيعطي error عند حذف موظف عمل فواتير)
-- ══════════════════════════════════════════════════════════
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_created_by_fkey;
ALTER TABLE invoices 
  ADD CONSTRAINT invoices_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES employees(id) ON DELETE SET NULL;

-- إصلاح deals أيضاً لو في مشكلة
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_employee_id_fkey;
ALTER TABLE deals 
  ADD CONSTRAINT deals_employee_id_fkey 
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;

-- إصلاح transactions
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_employee_id_fkey;
ALTER TABLE transactions 
  ADD CONSTRAINT transactions_employee_id_fkey 
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;

-- ══════════════════════════════════════════════════════════
-- 2. إضافة صور للمنتجات
-- ══════════════════════════════════════════════════════════
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- ══════════════════════════════════════════════════════════
-- 3. إضافة حالة الخدمة للموظفين
-- ══════════════════════════════════════════════════════════
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS employment_status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS resignation_date   DATE,
  ADD COLUMN IF NOT EXISTS termination_date   DATE,
  ADD COLUMN IF NOT EXISTS end_of_service_reason TEXT,
  ADD COLUMN IF NOT EXISTS hire_date          DATE;

-- تحديث الموظفين الحاليين لحالة نشط
UPDATE employees SET employment_status = 'active' WHERE employment_status IS NULL;

-- ══════════════════════════════════════════════════════════
-- 4. جدول المهام (Tasks)
-- ══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tasks (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  title            TEXT NOT NULL,
  description      TEXT,
  assigned_by      INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  assigned_to      INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  due_date         TIMESTAMPTZ,
  priority         TEXT DEFAULT 'medium' 
                   CHECK (priority IN ('low','medium','high','urgent')),
  status           TEXT DEFAULT 'pending' 
                   CHECK (status IN ('pending','acknowledged','in_progress','completed','rejected')),
  attachment_url   TEXT,
  attachment_name  TEXT,
  notes            TEXT,
  is_read          BOOLEAN DEFAULT false
);

-- ══════════════════════════════════════════════════════════
-- 5. جدول ردود المهام (Task Replies)
-- ══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS task_replies (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id          UUID REFERENCES tasks(id) ON DELETE CASCADE,
  employee_id      INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  message          TEXT NOT NULL,
  attachment_url   TEXT,
  attachment_name  TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════
-- 6. Storage Buckets
-- ══════════════════════════════════════════════════════════

-- Bucket لصور المنتجات
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Bucket لمرفقات المهام
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- سياسات الوصول - product-images
DROP POLICY IF EXISTS "product-images Access"  ON storage.objects;
DROP POLICY IF EXISTS "product-images Insert"  ON storage.objects;
DROP POLICY IF EXISTS "product-images Update"  ON storage.objects;
DROP POLICY IF EXISTS "product-images Delete"  ON storage.objects;

CREATE POLICY "product-images Access" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "product-images Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images');
CREATE POLICY "product-images Update" ON storage.objects FOR UPDATE USING (bucket_id = 'product-images');
CREATE POLICY "product-images Delete" ON storage.objects FOR DELETE USING (bucket_id = 'product-images');

-- سياسات الوصول - task-attachments
DROP POLICY IF EXISTS "task-attachments Access" ON storage.objects;
DROP POLICY IF EXISTS "task-attachments Insert" ON storage.objects;
DROP POLICY IF EXISTS "task-attachments Update" ON storage.objects;
DROP POLICY IF EXISTS "task-attachments Delete" ON storage.objects;

CREATE POLICY "task-attachments Access" ON storage.objects FOR SELECT USING (bucket_id = 'task-attachments');
CREATE POLICY "task-attachments Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'task-attachments');
CREATE POLICY "task-attachments Update" ON storage.objects FOR UPDATE USING (bucket_id = 'task-attachments');
CREATE POLICY "task-attachments Delete" ON storage.objects FOR DELETE USING (bucket_id = 'task-attachments');

-- ══════════════════════════════════════════════════════════
-- 7. Row Level Security (RLS) للجداول الجديدة
-- ══════════════════════════════════════════════════════════
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tasks_all" ON tasks;
DROP POLICY IF EXISTS "task_replies_all" ON task_replies;

CREATE POLICY "tasks_all" ON tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "task_replies_all" ON task_replies FOR ALL USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════
-- 8. تحقق نهائي
-- ══════════════════════════════════════════════════════════
SELECT 'FRESH FOOD FULL UPDATE COMPLETE ✅' AS status;
SELECT 
  (SELECT COUNT(*) FROM tasks) as tasks_count,
  (SELECT COUNT(*) FROM task_replies) as task_replies_count,
  (SELECT column_name FROM information_schema.columns 
   WHERE table_name='products' AND column_name='image_url') as products_image_col,
  (SELECT column_name FROM information_schema.columns 
   WHERE table_name='employees' AND column_name='employment_status') as emp_status_col;
