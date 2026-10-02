/** "★★★★☆" with an accessible label. */
export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const full = Math.round(value);
  return (
    <span
      className="stars"
      style={{ fontSize: size }}
      role="img"
      aria-label={`${value} out of 5 stars`}
    >
      {'★'.repeat(full)}
      <span className="stars--muted">{'★'.repeat(5 - full)}</span>
    </span>
  );
}
