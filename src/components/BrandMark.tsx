export default function BrandMark({
  className = "h-10 w-10",
}: {
  className?: string;
}): JSX.Element {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect x="8" y="10" width="48" height="44" rx="14" fill="#0F172A" />
      <rect x="14" y="16" width="24" height="32" rx="8" fill="#F8FAFC" />
      <rect x="26" y="16" width="24" height="32" rx="8" fill="#F97316" />
      <path
        d="M19 25.5h12M19 31.5h10M19 37.5h7"
        stroke="#0F172A"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M31 24.5 38.5 32 31 39.5"
        stroke="#FFF7ED"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="47" cy="19" r="5" fill="#14B8A6" />
      <path
        d="M42.5 46.5h9"
        stroke="#FFF7ED"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
