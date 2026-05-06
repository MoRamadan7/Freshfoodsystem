-- =============================================================
-- FreshFood System - Backfill & Sync ALL Existing Completed Deals
-- يقوم هذا السكريبت بمزامنة الصفقات القديمة المكتملة مع:
--   1. جدول المعاملات المالية (transactions) - الإيرادات والعمولات
--   2. جدول الفواتير (invoices) وبنودها (invoice_items)
--
-- طريقة الاستخدام: نسخ الكود ولصقه في SQL Editor في Supabase ثم Run
-- =============================================================

-- 0. أولاً: إضافة نوع 'commission' لجدول المعاملات إن لم يكن موجوداً
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('revenue','expense','salary','advance','deduction','waste','purchase_payment','commission'));

DO $$
DECLARE
    deal_rec  RECORD;
    v_invoice_id   INTEGER;
    v_invoice_num  TEXT;
    v_prefix       TEXT;
    v_product_name TEXT;
    v_tx_exists    BOOLEAN;
    v_inv_exists   BOOLEAN;
    v_comm_exists  BOOLEAN;
BEGIN
    -- الحصول على بريفكس الفاتورة
    SELECT COALESCE(invoice_prefix, 'INV-') INTO v_prefix FROM company_settings LIMIT 1;

    RAISE NOTICE '=== بدء مزامنة الصفقات المكتملة ===';

    -- تكرار على كل الصفقات المكتملة
    FOR deal_rec IN
        SELECT d.*,
               c.client_name,
               p.product_name,
               p.stock_quantity
        FROM deals d
        LEFT JOIN clients c ON c.id = d.client_id
        LEFT JOIN products p ON p.id = d.product_id
        WHERE d.status IN ('contracted', 'won')
          AND d.total_amount > 0
        ORDER BY d.id
    LOOP

        -- ============================================================
        -- 1. خصم المخزون إذا لم يُخصم بعد (يمكن تعطيل هذا القسم)
        -- ============================================================
        -- ملاحظة: هذا الجزء معطّل للأمان. فعّله يدوياً إذا أردت خصم المخزون
        -- IF deal_rec.product_id IS NOT NULL AND deal_rec.quantity > 0 THEN
        --     UPDATE products
        --     SET stock_quantity = GREATEST(0, stock_quantity - deal_rec.quantity)
        --     WHERE id = deal_rec.product_id;
        --     RAISE NOTICE 'Deducted % units from product % for deal %',
        --         deal_rec.quantity, deal_rec.product_id, deal_rec.id;
        -- END IF;

        -- ============================================================
        -- 2. إنشاء معاملة الإيراد إن لم تكن موجودة
        -- ============================================================
        SELECT EXISTS(
            SELECT 1 FROM transactions
            WHERE notes LIKE '%صفقة رقم: ' || deal_rec.id || '%'
              AND type = 'revenue'
        ) INTO v_tx_exists;

        IF NOT v_tx_exists THEN
            INSERT INTO transactions (date, type, amount, client_id, employee_id, station_id, notes)
            VALUES (
                COALESCE(deal_rec.created_date::DATE, CURRENT_DATE),
                'revenue',
                deal_rec.total_amount,
                deal_rec.client_id,
                deal_rec.employee_id,
                deal_rec.station_id,
                'ناتج عن إتمام صفقة رقم: ' || deal_rec.id || ' (مزامنة تلقائية)'
            );
            RAISE NOTICE '[✅ معاملة إيراد] تمت لصفقة #%', deal_rec.id;
        ELSE
            RAISE NOTICE '[⏭ موجودة] معاملة إيراد لصفقة #%', deal_rec.id;
        END IF;

        -- ============================================================
        -- 3. إنشاء معاملة العمولة إن وجدت ولم تُسجّل
        -- ============================================================
        IF deal_rec.commission_rate > 0 AND deal_rec.employee_id IS NOT NULL THEN
            SELECT EXISTS(
                SELECT 1 FROM transactions
                WHERE notes LIKE '%عمولة%صفقة رقم: ' || deal_rec.id || '%'
                  AND type = 'commission'
            ) INTO v_comm_exists;

            IF NOT v_comm_exists THEN
                INSERT INTO transactions (date, type, amount, employee_id, station_id, notes)
                VALUES (
                    COALESCE(deal_rec.created_date::DATE, CURRENT_DATE),
                    'commission',
                    ROUND((deal_rec.total_amount * deal_rec.commission_rate / 100)::NUMERIC, 2),
                    deal_rec.employee_id,
                    deal_rec.station_id,
                    'عمولة ' || deal_rec.commission_rate || '% على صفقة رقم: ' || deal_rec.id || ' (مزامنة تلقائية)'
                );
                RAISE NOTICE '[✅ عمولة] تمت لصفقة #%', deal_rec.id;
            END IF;
        END IF;

        -- ============================================================
        -- 4. إنشاء الفاتورة إن لم تكن موجودة
        -- ============================================================
        SELECT EXISTS(
            SELECT 1 FROM invoices WHERE deal_id = deal_rec.id
        ) INTO v_inv_exists;

        IF NOT v_inv_exists THEN
            v_invoice_num := v_prefix ||
                TO_CHAR(COALESCE(deal_rec.created_date::DATE, NOW()), 'YYYYMMDD') ||
                '-' || deal_rec.id;

            INSERT INTO invoices (
                invoice_number, client_id, deal_id, issue_date,
                status, subtotal, total, tax_rate, tax_amount,
                created_by, station_id, notes
            )
            VALUES (
                v_invoice_num,
                deal_rec.client_id,
                deal_rec.id,
                COALESCE(deal_rec.created_date::DATE, CURRENT_DATE),
                'paid',
                deal_rec.total_amount,
                deal_rec.total_amount,
                0, 0,
                deal_rec.employee_id,
                deal_rec.station_id,
                'فاتورة آلية ناتجة عن صفقة رقم: ' || deal_rec.id || ' (مزامنة تلقائية)'
            )
            RETURNING id INTO v_invoice_id;

            -- بنود الفاتورة
            v_product_name := COALESCE(deal_rec.product_name, 'منتج غير محدد');

            INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total)
            VALUES (
                v_invoice_id,
                v_product_name || CASE WHEN deal_rec.unit IS NOT NULL THEN ' (' || deal_rec.unit || ')' ELSE '' END,
                COALESCE(deal_rec.quantity, 1),
                CASE WHEN COALESCE(deal_rec.quantity, 0) > 0
                     THEN ROUND((deal_rec.total_amount / deal_rec.quantity)::NUMERIC, 2)
                     ELSE deal_rec.total_amount END,
                deal_rec.total_amount
            );

            RAISE NOTICE '[✅ فاتورة] رقم % تمت لصفقة #%', v_invoice_num, deal_rec.id;
        ELSE
            RAISE NOTICE '[⏭ موجودة] فاتورة لصفقة #%', deal_rec.id;
        END IF;

    END LOOP;

    RAISE NOTICE '=== اكتملت المزامنة ===';
END;
$$;


-- ============================================================
-- تقرير ملخص بعد المزامنة
-- ============================================================
SELECT
    d.id                                            AS deal_id,
    COALESCE(c.client_name, 'غير معروف')           AS client,
    d.status,
    d.total_amount                                  AS amount,
    CASE WHEN t.id  IS NOT NULL THEN '✅ موجودة' ELSE '❌ مفقودة' END AS transaction_status,
    CASE WHEN cm.id IS NOT NULL THEN '✅ موجودة' ELSE
         CASE WHEN d.commission_rate > 0 THEN '❌ مفقودة' ELSE 'لا توجد' END
    END AS commission_status,
    CASE WHEN i.id  IS NOT NULL THEN '✅ موجودة' ELSE '❌ مفقودة' END AS invoice_status
FROM deals d
LEFT JOIN clients c ON c.id = d.client_id
LEFT JOIN transactions t  ON t.notes LIKE '%صفقة رقم: ' || d.id || '%' AND t.type = 'revenue'
LEFT JOIN transactions cm ON cm.notes LIKE '%صفقة رقم: ' || d.id || '%' AND cm.type = 'commission'
LEFT JOIN invoices i ON i.deal_id = d.id
WHERE d.status IN ('contracted', 'won')
ORDER BY d.id;
