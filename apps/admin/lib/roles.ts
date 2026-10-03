import { type MessageKey, type Translate } from '@nixzora/i18n';

/** Every role the API knows, in the order staff see them. */
export const ROLE_KEYS = ['customer', 'support', 'catalog_manager', 'admin'] as const;

/** "catalog_manager" → "Catalog manager" in the staff member's language; unknown keys as-is. */
export function roleLabel(t: Translate<'ops'>, key: string): string {
  return (ROLE_KEYS as readonly string[]).includes(key)
    ? t(`role_${key}` as MessageKey<'ops'>)
    : key;
}
