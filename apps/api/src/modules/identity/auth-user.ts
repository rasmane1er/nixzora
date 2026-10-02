/** The authenticated caller, attached to the request by AccessTokenGuard. */
export type AuthUser = {
  id: string;
  email: string;
  sessionId: string;
  roles: string[];
  permissions: string[];
  mfaEnabled: boolean;
  /** True when this session passed a second factor. */
  mfaVerified: boolean;
};

/** Any permission in this list marks a staff-only route: MFA is mandatory to use it. */
export const STAFF_PERMISSIONS = new Set([
  'admin.access',
  'users.read',
  'users.manage',
  'roles.manage',
  'catalog.write',
  'inventory.write',
  'orders.read.all',
  'orders.fulfill',
  'reviews.moderate',
  'promotions.manage',
  'customers.notes',
  'orders.refund',
  'audit.read',
]);
