-- Reference data: the Phase 1 roles and permissions.
-- Idempotent so it is safe on databases where some rows already exist.

INSERT INTO "permissions" ("id", "key", "description") VALUES
  (gen_random_uuid(), 'account.manage.own', 'Read and update your own account, sessions and MFA'),
  (gen_random_uuid(), 'orders.read.own', 'See your own orders'),
  (gen_random_uuid(), 'orders.create', 'Place orders'),
  (gen_random_uuid(), 'admin.access', 'Sign in to the Ops Center (staff only, MFA required)'),
  (gen_random_uuid(), 'users.read', 'Look up customer and staff accounts'),
  (gen_random_uuid(), 'users.manage', 'Suspend accounts and revoke their sessions'),
  (gen_random_uuid(), 'roles.manage', 'Grant and remove roles'),
  (gen_random_uuid(), 'catalog.write', 'Create and edit products, categories and brands'),
  (gen_random_uuid(), 'inventory.write', 'Adjust stock levels'),
  (gen_random_uuid(), 'orders.read.all', 'See every order'),
  (gen_random_uuid(), 'orders.refund', 'Issue refunds'),
  (gen_random_uuid(), 'audit.read', 'Read the audit log')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "roles" ("id", "key", "name", "description") VALUES
  (gen_random_uuid(), 'customer', 'Customer', 'Every shopper account'),
  (gen_random_uuid(), 'support', 'Support agent', 'Helps customers with orders and accounts'),
  (gen_random_uuid(), 'catalog_manager', 'Catalog manager', 'Maintains products and inventory'),
  (gen_random_uuid(), 'admin', 'Administrator', 'Full access to the Ops Center')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM (VALUES
  ('customer', 'account.manage.own'),
  ('customer', 'orders.read.own'),
  ('customer', 'orders.create'),
  ('support', 'account.manage.own'),
  ('support', 'admin.access'),
  ('support', 'users.read'),
  ('support', 'orders.read.all'),
  ('catalog_manager', 'account.manage.own'),
  ('catalog_manager', 'admin.access'),
  ('catalog_manager', 'catalog.write'),
  ('catalog_manager', 'inventory.write'),
  ('admin', 'account.manage.own'),
  ('admin', 'admin.access'),
  ('admin', 'users.read'),
  ('admin', 'users.manage'),
  ('admin', 'roles.manage'),
  ('admin', 'catalog.write'),
  ('admin', 'inventory.write'),
  ('admin', 'orders.read.all'),
  ('admin', 'orders.refund'),
  ('admin', 'audit.read')
) AS grants("role_key", "permission_key")
JOIN "roles" r ON r."key" = grants."role_key"
JOIN "permissions" p ON p."key" = grants."permission_key"
ON CONFLICT DO NOTHING;
