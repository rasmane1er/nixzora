const PATHS: Record<string, string> = {
  orders: 'M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Zm0 0L12 12m0 0 9-4.5M12 12v9M7.5 5.25l9 4.5',
  security:
    'M12 3 4.5 6v5.25c0 4.5 3.2 8.1 7.5 9.75 4.3-1.65 7.5-5.25 7.5-9.75V6L12 3Zm-3 9 2 2 4-4',
  addresses:
    'M12 21s-6.75-6-6.75-11.25a6.75 6.75 0 0 1 13.5 0C18.75 15 12 21 12 21Zm0-8.5a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Z',
  returns: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  reviews:
    'm12 3.5 2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.65l5.9-.85L12 3.5Z',
  wishlist:
    'M12 20.25s-7.5-4.6-7.5-10.1A4.15 4.15 0 0 1 12 7.6a4.15 4.15 0 0 1 7.5 2.55c0 5.5-7.5 10.1-7.5 10.1Z',
  preferences:
    'M14.9 18.75a3 3 0 0 1-5.8 0M18 9.75a6 6 0 1 0-12 0c0 6.75-2.25 7.5-2.25 7.5h16.5S18 16.5 18 9.75Z',
  privacy: 'M7.5 10.5V7.5a4.5 4.5 0 0 1 9 0v3M5.25 10.5h13.5v10.5H5.25V10.5Zm6.75 4.5v2.25',
  store:
    'M3.75 9 5.25 3.75h13.5L20.25 9M3.75 9h16.5M3.75 9v.75a2.75 2.75 0 0 0 5.5 0M9.25 9v.75a2.75 2.75 0 0 0 5.5 0M14.75 9v.75a2.75 2.75 0 0 0 5.5 0M5.25 12.5v7.75h13.5V12.5M10 20.25v-4.5h4v4.5',
  assistant:
    'M12 3v3m0 12v3M3 12h3m12 0h3M6.3 6.3l2.1 2.1m7.2 7.2 2.1 2.1m0-11.4-2.1 2.1m-7.2 7.2-2.1 2.1',
};

/** Line icons for the account hub (24px grid, drawn for this project). */
export function AccountIcon({ name }: { name: keyof typeof PATHS }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
