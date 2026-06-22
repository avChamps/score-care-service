INSERT INTO employee_role_permissions (
  role_id,
  menu_name,
  child_menu_name,
  child_menu_key,
  permissions
)
SELECT
  er.id,
  'General',
  'Website Settings',
  'Website Settings',
  JSON_ARRAY('view', 'read', 'update')
FROM employee_roles er
WHERE er.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM employee_role_permissions erp
    WHERE erp.role_id = er.id
      AND erp.menu_name = 'General'
      AND erp.child_menu_key = 'Website Settings'
  );
