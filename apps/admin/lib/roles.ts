import { type MessageKey, type Translate } from '@nixzora/i18n';
import { ROLE_KEYS } from '@nixzora/validation';

export { ROLE_KEYS };

/** "catalog_manager" → "Catalog manager" in the staff member's language; unknown keys as-is. */
export function roleLabel(t: Translate<'ops'>, key: string): string {
  return (ROLE_KEYS as readonly string[]).includes(key)
    ? t(`role_${key}` as MessageKey<'ops'>)
    : key;
}
