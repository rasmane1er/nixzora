/** True when a write failed because a unique column (slug, SKU, email…) already has that value. */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002'
  );
}

/** True when an update or delete targeted a row that does not exist. */
export function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2025'
  );
}
