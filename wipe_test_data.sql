-- =============================================================
-- FRESH FOOD ERP - WIPE TEST DATA & NEW FEATURES SETUP
-- شغّل هذا الملف كاملاً في Supabase SQL Editor
-- هذا الكود سيقوم بمسح الداتا التجريبية للحضور، الفواتير، المعاملات، 
-- المنتجات، العملاء، والمهام والموظفين (باستثناء المديرين).
-- كما سيقوم بإنشاء جدول الدردشة الداخلية.
-- =============================================================

-- 1. مسح البيانات المترابطة (مع تفعيل ON DELETE CASCADE أو الحذف المباشر)
DELETE FROM invoice_items;
DELETE FROM invoices;
DELETE FROM transactions;
DELETE FROM payroll_records;
DELETE FROM attendance;
DELETE FROM deals;
DELETE FROM task_replies;
DELETE FROM tasks;
DELETE FROM products;
DELETE FROM clients;
DELETE FROM suppliers;
DELETE FROM activity_logs;

-- 2. مسح الموظفين العاديين والإبقاء على المديرين فقط
-- إذا كانت أدوار المديرين تختلف، يمكنك تعديل القائمة في السطر التالي:
DELETE FROM employees 
WHERE role NOT IN ('Admin', 'Manager', 'مدير', 'مدير النظام', 'admin', 'manager');

-- 3. تصفير العدادات للأيدي (اختياري لكن مفضل للبدء من 1)
ALTER SEQUENCE IF EXISTS invoices_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS invoice_items_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS transactions_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS payroll_records_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS attendance_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS deals_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS products_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS clients_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS suppliers_id_seq RESTART WITH 1;

-- =============================================================
-- 4. إنشاء جدول الدردشة الداخلية (Internal Chat)
-- =============================================================
CREATE TABLE IF NOT EXISTS internal_messages (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id        INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  receiver_id      INTEGER REFERENCES employees(id) ON DELETE CASCADE, -- إذا كان NULL يعني للجميع (General Chat)
  message          TEXT NOT NULL,
  attachment_url   TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  is_read          BOOLEAN DEFAULT false
);

-- سياسات الوصول لجدول الدردشة
ALTER TABLE internal_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages_all" ON internal_messages;
CREATE POLICY "messages_all" ON internal_messages FOR ALL USING (true) WITH CHECK (true);

-- =============================================================
-- 5. Bucket الخاص بمرفقات الدردشة (إن لم يكن موجوداً)
-- =============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "chat-attachments Access" ON storage.objects;
DROP POLICY IF EXISTS "chat-attachments Insert" ON storage.objects;
DROP POLICY IF EXISTS "chat-attachments Update" ON storage.objects;
DROP POLICY IF EXISTS "chat-attachments Delete" ON storage.objects;

CREATE POLICY "chat-attachments Access" ON storage.objects FOR SELECT USING (bucket_id = 'chat-attachments');
CREATE POLICY "chat-attachments Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat-attachments');
CREATE POLICY "chat-attachments Update" ON storage.objects FOR UPDATE USING (bucket_id = 'chat-attachments');
CREATE POLICY "chat-attachments Delete" ON storage.objects FOR DELETE USING (bucket_id = 'chat-attachments');

-- إتمام
SELECT 'WIPE DATA & CHAT SETUP COMPLETE ✅' AS status;
