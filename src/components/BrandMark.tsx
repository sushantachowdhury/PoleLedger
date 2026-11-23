interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className = 'w-6 h-6' }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="2" y="2" width="24" height="24" rx="6" className="fill-sky-500/15 stroke-sky-400/50" strokeWidth="1.25" />
      <path
        d="M11 22V8.5C11 7.67157 11.6716 7 12.5 7H19.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path d="M8.5 22H13.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M11 12L15 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <rect x="17" y="6.25" width="4.5" height="2.25" rx="1" className="fill-amber-400" />
    </svg>
  );
}
