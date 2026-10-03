/** A profile photo, or the customer's initials on the brand colour when there is none. */
export function Avatar({
  url,
  name,
  email,
  size = 72,
}: {
  url: string | null;
  name: string;
  email: string;
  size?: number;
}) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join('') || email[0]!.toUpperCase();
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="avatar"
      src={url}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="avatar avatar--initials"
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  );
}
