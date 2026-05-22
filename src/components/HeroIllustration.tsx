export default function HeroIllustration(): JSX.Element {
  return (
    <div className="relative mx-auto w-full max-w-[28rem]">
      <div className="absolute -left-4 top-12 h-24 w-24 rounded-[2rem] bg-[var(--color-accent)] opacity-20" />
      <div className="absolute -right-2 top-4 h-20 w-20 rounded-full bg-[var(--color-highlight)] opacity-25" />
      <svg viewBox="0 0 500 360" className="relative z-10 w-full" fill="none" aria-hidden="true">
        <rect x="56" y="48" width="182" height="232" rx="34" fill="#F8FAFC" />
        <rect x="56" y="48" width="182" height="232" rx="34" stroke="#0F172A" strokeWidth="8" />
        <rect x="88" y="88" width="118" height="20" rx="10" fill="#14B8A6" />
        <rect x="88" y="124" width="96" height="14" rx="7" fill="#CBD5E1" />
        <rect x="88" y="150" width="82" height="14" rx="7" fill="#CBD5E1" />
        <rect x="88" y="186" width="92" height="44" rx="16" fill="#FED7AA" />
        <path d="M260 134H318" stroke="#0F172A" strokeWidth="10" strokeLinecap="round" />
        <path
          d="m298 110 24 24-24 24"
          stroke="#0F172A"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="330" y="76" width="114" height="92" rx="24" fill="#F97316" />
        <rect x="330" y="76" width="114" height="92" rx="24" stroke="#0F172A" strokeWidth="8" />
        <path d="M360 108h54M360 128h40" stroke="#FFF7ED" strokeWidth="8" strokeLinecap="round" />
        <rect x="300" y="192" width="146" height="106" rx="28" fill="#14B8A6" />
        <rect x="300" y="192" width="146" height="106" rx="28" stroke="#0F172A" strokeWidth="8" />
        <path d="M332 226h82M332 248h58M332 270h66" stroke="#ECFEFF" strokeWidth="8" strokeLinecap="round" />
        <circle cx="250" cy="60" r="20" fill="#FACC15" stroke="#0F172A" strokeWidth="8" />
        <circle cx="272" cy="304" r="14" fill="#F8FAFC" stroke="#0F172A" strokeWidth="8" />
      </svg>
    </div>
  );
}
