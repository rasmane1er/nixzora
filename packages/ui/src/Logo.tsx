type LogoProps = {
  /** Size of the square mark in pixels. */
  size?: number;
  /** Show the NIXZORA wordmark next to the mark. */
  wordmark?: boolean;
  /** Use the reversed tile for dark backgrounds. */
  inverted?: boolean;
};

/**
 * The NIXZORA mark: one continuous path forming an N that climbs to an orange node —
 * a need, the search, and the right product found.
 */
export function Logo({ size = 36, wordmark = true, inverted = false }: LogoProps) {
  // Theme-aware by default; `inverted` forces the reversed tile on dark surfaces.
  const tile = inverted ? 'var(--color-paper)' : 'var(--logo-tile)';
  const stroke = inverted ? 'var(--color-ink)' : 'var(--logo-stroke)';

  return (
    <span className="logo">
      <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="NIXZORA">
        <rect width="64" height="64" rx="16" fill={tile} />
        <path
          d="M19 46V18l26 28V27"
          fill="none"
          stroke={stroke}
          strokeWidth="6.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="45" cy="15.5" r="5.5" fill="var(--color-signal)" />
      </svg>
      {wordmark ? (
        <span className="logo__word" aria-hidden="true">
          NIXZORA
        </span>
      ) : null}
    </span>
  );
}
