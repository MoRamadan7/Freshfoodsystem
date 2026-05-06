-- =============================================================
-- FRESH FOOD ERP - ENTERPRISE UPDATE SQL
-- =============================================================

-- 1. جدول الصلاحيات الديناميكية (Dynamic Roles)
-- (تم نقل النظام ليعتمد على جدول settings (JSONB) لمرونة أكبر، ولكن ننشئ هذا الجدول كاحتياطي للربط المستقبلي)
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  permissions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. دعم الحقول الإضافية المرنة (Custom Fields)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS custom_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS custom_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS custom_data JSONB DEFAULT '{}'::jsonb;

-- 3. تطوير نظام المهام (Group/Multi-assignee Tasks)
-- النظام الآن يدعم الإسناد لعدة موظفين عبر إنشاء سجلات متعددة في جدول tasks

-- 4. تطوير نظام الدردشة (Read Receipts)
ALTER TABLE internal_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- 5. بوابة العملاء (Client Portal)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_token TEXT UNIQUE;

-- =============================================================
-- تم الانتهاء من التحديثات الهيكلية بنجاح!
-- =============================================================
