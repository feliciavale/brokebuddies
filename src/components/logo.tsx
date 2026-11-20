/** Same mark as the favicon (src/app/icon.svg). */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="6" fill="#4D1A00" />
      <path d="M9 6h14v19l-2.333-1.75L18.333 25 16 23.25 13.667 25l-2.334-1.75L9 25z" fill="#F0E7C8" />
      <path d="M16 8.5v12.5" stroke="#B22000" strokeWidth="2" strokeDasharray="2 1.6" />
      <path
        d="M11.25 11h2.25M11.25 14.5h2.25M18.5 11h2.25M18.5 14.5h2.25"
        stroke="#4D1A00"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
