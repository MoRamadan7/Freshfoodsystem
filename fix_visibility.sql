-- SQL to fix Employee Visibility and RLS issues
-- Run this in Supabase SQL Editor

-- 1. Ensure RLS is configured to allow Managers and HR to see all employees
-- First, disable RLS temporarily to reset or just add a permissive policy
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers and HR can view all employees" ON employees;
CREATE POLICY "Managers and HR can view all employees" ON employees
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE email = auth.email() 
      AND (role IN ('admin', 'manager', 'hr', 'مدير', 'مشرف', 'موارد بشرية'))
    )
    OR email = auth.email()
  );

-- 2. If the manager still doesn't see everyone, it might be due to a caching issue or role string mismatch
-- This update ensures roles are trimmed and consistent
UPDATE employees SET role = TRIM(role);

-- 3. Ensure station visibility (if you want to restrict by station later, but for now allow viewing all)
DROP POLICY IF EXISTS "Allow authenticated view stations" ON stations;
CREATE POLICY "Allow authenticated view stations" ON stations
  FOR SELECT TO authenticated
  USING (true);
