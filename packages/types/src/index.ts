export type { Currency, DependencyCheck, HealthResponse, Money } from '@nixzora/validation';

/** Opaque identifier types keep IDs from different tables from being mixed up. */
type Brand<T, B extends string> = T & { readonly __brand: B };

export type UserId = Brand<string, 'UserId'>;
export type ProductId = Brand<string, 'ProductId'>;
export type VariantId = Brand<string, 'VariantId'>;
export type OrderId = Brand<string, 'OrderId'>;

/** Roles available in Phase 1 RBAC. Sellers arrive in Phase 7. */
export type RoleKey = 'customer' | 'admin' | 'support' | 'catalog_manager';
