INSERT INTO employee_role_permissions (
  role_id,
  menu_name,
  child_menu_name,
  child_menu_key,
  permissions
)
SELECT
  er.id,
  missing.menu_name,
  missing.child_menu_name,
  COALESCE(missing.child_menu_name, ''),
  missing.permissions
FROM employee_roles er
JOIN (
  SELECT 'Employee management' AS menu_name, 'Login Events' AS child_menu_name, JSON_ARRAY('read') AS permissions
  UNION ALL SELECT 'Subscriptions', 'Subscription Plans', JSON_ARRAY('create', 'read', 'update')
  UNION ALL SELECT 'Subscriptions', 'Basic Subscriptions', JSON_ARRAY('read')
  UNION ALL SELECT 'Plans & Benefits', 'Loan Options', JSON_ARRAY('create', 'read', 'update')
  UNION ALL SELECT 'Credit Repair', 'Repair Requests', JSON_ARRAY('create', 'read', 'update')
  UNION ALL SELECT 'Disputes', NULL, JSON_ARRAY('read', 'update')
  UNION ALL SELECT 'Loans', NULL, JSON_ARRAY('read', 'update', 'export')
  UNION ALL SELECT 'Reports', 'Credit Bureau API Hits', JSON_ARRAY('read')
  UNION ALL SELECT 'Reports', 'Manual Downloads', JSON_ARRAY('read', 'export')
) missing
WHERE er.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM employee_role_permissions erp
    WHERE erp.role_id = er.id
      AND erp.menu_name = missing.menu_name
      AND erp.child_menu_key = COALESCE(missing.child_menu_name, '')
  );
