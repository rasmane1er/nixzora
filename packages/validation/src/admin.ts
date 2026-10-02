import { z } from 'zod';

export const UserListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  role: z.string().max(40).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const RoleGrantSchema = z.object({
  roleKey: z.enum(['customer', 'support', 'catalog_manager', 'admin']),
});

export const AdminUserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']),
  emailVerified: z.boolean(),
  mfaEnabled: z.boolean(),
  roles: z.array(z.string()),
  activeSessions: z.number().int(),
  createdAt: z.iso.datetime(),
});

export type UserListQuery = z.infer<typeof UserListQuerySchema>;
export type RoleGrant = z.infer<typeof RoleGrantSchema>;
export type AdminUser = z.infer<typeof AdminUserSchema>;
