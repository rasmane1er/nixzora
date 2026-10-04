/** A fingerprint, for passkey and biometric sign-in buttons. */
export function FingerprintIcon({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none">
      <path
        d="M6.6 5.2A8.25 8.25 0 0 1 20.25 11.4v1.35M3.75 15V11.4c0-1.6.45-3.1 1.25-4.35M7.5 19.5a12 12 0 0 0 1.5-5.85V11.4a3 3 0 1 1 6 0v1.35M12 11.4v2.25c0 3.1-1 5.95-2.7 8.25M18.3 16.5a15.7 15.7 0 0 1-1.65 4.5M15 15.75a11.7 11.7 0 0 1-.9 3.45"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
