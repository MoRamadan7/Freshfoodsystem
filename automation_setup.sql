-- FreshFood System - Automation & Privacy Script
-- نسخ هذا الكود بالكامل ولصقه في قسم SQL Editor في Supabase ثم الضغط على Run

-- 0. تمديد check constraint على جدول transactions ليشمل 'commission'
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('revenue','expense','salary','advance','deduction','waste','purchase_payment','commission'));

-- 1. إضافة حقول جديدة لجدول العملاء وإعدادات الشركة
ALTER TABLE clients ADD COLUMN IF NOT EXISTS assigned_sales_id INTEGER REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS stamp_url TEXT;

-- 2. دالة معالجة إتمام الصفقة (Automation Function)
CREATE OR REPLACE FUNCTION handle_deal_completion()
RETURNS TRIGGER AS $$
DECLARE
    v_invoice_id INTEGER;
    v_invoice_num TEXT;
    v_prefix TEXT;
BEGIN
    -- التحقق من أن الحالة تغيرت إلى 'contracted' أو 'won' (تم التعاقد)
    IF (NEW.status IN ('contracted', 'won') AND (OLD.status IS NULL OR OLD.status NOT IN ('contracted', 'won'))) THEN
        
        -- أ. خصم من المخزون
        IF NEW.product_id IS NOT NULL AND NEW.quantity > 0 THEN
            UPDATE products 
            SET stock_quantity = stock_quantity - NEW.quantity
            WHERE id = NEW.product_id;
        END IF;

        -- ب. تسجيل المعاملة المالية (الخزنة)
        INSERT INTO transactions (
            date, type, amount, client_id, employee_id, station_id, notes
        ) VALUES (
            CURRENT_DATE, 'revenue', NEW.total_amount, NEW.client_id, NEW.employee_id, NEW.station_id, 
            'ناتج عن إتمام صفقة رقم: ' || NEW.id
        );

        -- ج. إنشاء الفاتورة تلقائياً
        -- الحصول على البريفكس من الإعدادات
        SELECT invoice_prefix INTO v_prefix FROM company_settings LIMIT 1;
        IF v_prefix IS NULL THEN v_prefix := 'INV-'; END IF;
        
        v_invoice_num := v_prefix || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || NEW.id;

        INSERT INTO invoices (
            invoice_number, client_id, deal_id, issue_date, status, subtotal, total, created_by, station_id, notes
        ) VALUES (
            v_invoice_num, NEW.client_id, NEW.id, CURRENT_DATE, 'paid', NEW.total_amount, NEW.total_amount, NEW.employee_id, NEW.station_id,
            'فاتورة آلية ناتجة عن صفقة رقم: ' || NEW.id
        ) RETURNING id INTO v_invoice_id;

        -- د. إضافة بنود الفاتورة
        INSERT INTO invoice_items (
            invoice_id, description, quantity, unit_price, total
        ) VALUES (
            v_invoice_id, 
            (SELECT product_name FROM products WHERE id = NEW.product_id) || ' (' || NEW.unit || ')',
            NEW.quantity,
            CASE WHEN NEW.quantity > 0 THEN NEW.total_amount / NEW.quantity ELSE 0 END,
            NEW.total_amount
        );

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. إنشاء التريجر (Trigger)
DROP TRIGGER IF EXISTS on_deal_status_change ON deals;
CREATE TRIGGER on_deal_status_change
AFTER UPDATE ON deals
FOR EACH ROW
EXECUTE FUNCTION handle_deal_completion();

-- 4. تحديث سجلات النشاط لتكون مرئية للمدير عن الجميع (تعديل السياسات إذا لزم الأمر)
-- (بافتراض أن السياسات مفعلة على الجدول)
-- ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "Managers see all logs" ON activity_logs;
-- CREATE POLICY "Managers see all logs" ON activity_logs 
-- FOR SELECT USING (EXISTS (SELECT 1 FROM employees WHERE id = auth.uid() AND role IN ('admin', 'manager')));
