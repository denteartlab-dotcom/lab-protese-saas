import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";

type Props = {
  locale: Locale;
  className?: string;
};

/** Bandeiras SVG: Brasil (pt), EUA (en), Espanha (es). */
export function FlagIcon({ locale, className }: Props) {
  const base = cn(
    "inline-block h-[11px] w-[16px] shrink-0 overflow-hidden rounded-[2px] border border-black/10 shadow-sm",
    className
  );

  if (locale === "en") {
    return (
      <svg viewBox="0 0 16 11" className={base} aria-hidden>
        <rect width="16" height="11" fill="#B22234" />
        <rect y="1.57" width="16" height="0.85" fill="#fff" />
        <rect y="3.14" width="16" height="0.85" fill="#fff" />
        <rect y="4.71" width="16" height="0.85" fill="#fff" />
        <rect y="6.28" width="16" height="0.85" fill="#fff" />
        <rect y="7.85" width="16" height="0.85" fill="#fff" />
        <rect y="9.42" width="16" height="0.85" fill="#fff" />
        <rect width="6.4" height="5.5" fill="#3C3B6E" />
        <circle cx="1.2" cy="1" r="0.35" fill="#fff" />
        <circle cx="2.4" cy="1" r="0.35" fill="#fff" />
        <circle cx="3.6" cy="1" r="0.35" fill="#fff" />
        <circle cx="1.8" cy="2" r="0.35" fill="#fff" />
        <circle cx="3" cy="2" r="0.35" fill="#fff" />
        <circle cx="4.2" cy="2" r="0.35" fill="#fff" />
      </svg>
    );
  }

  if (locale === "es") {
    return (
      <svg viewBox="0 0 16 11" className={base} aria-hidden>
        <rect width="16" height="11" fill="#AA151B" />
        <rect y="2.75" width="16" height="5.5" fill="#F1BF00" />
        <rect x="4" y="4" width="2.5" height="3.5" fill="#AA151B" opacity="0.85" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 16 11" className={base} aria-hidden>
      <rect width="16" height="11" fill="#009739" />
      <polygon points="8,1.2 14.2,5.5 8,9.8 1.8,5.5" fill="#FEDD00" />
      <circle cx="8" cy="5.5" r="2.2" fill="#002776" />
      <path
        d="M6.2 5.5c0-1 0.8-1.8 1.8-1.8"
        fill="none"
        stroke="#fff"
        strokeWidth="0.35"
      />
    </svg>
  );
}
