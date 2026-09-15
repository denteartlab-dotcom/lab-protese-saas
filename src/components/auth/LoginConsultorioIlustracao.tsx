/** Ilustração de consultório — branca, cores vivas, distinta do estilo Smart Prótese. */
export function LoginConsultorioIlustracao({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 680 440"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {/* Fundo branco + acentos geométricos */}
      <rect x="24" y="36" width="632" height="368" rx="28" fill="#FFFFFF" />
      <circle cx="86" cy="90" r="36" fill="#BFDBFE" />
      <circle cx="602" cy="360" r="48" fill="#93C5FD" fillOpacity="0.55" />
      <circle cx="560" cy="78" r="22" fill="#38BDF8" />
      <path
        d="M520 48c28-8 56 10 64 36"
        stroke="#60A5FA"
        strokeWidth="8"
        strokeLinecap="round"
      />

      {/* Janela clara */}
      <rect x="72" y="108" width="150" height="118" rx="14" fill="#E0F2FE" />
      <path d="M147 108v118" stroke="#FFFFFF" strokeWidth="8" />
      <path d="M72 167h150" stroke="#FFFFFF" strokeWidth="8" />
      <rect x="88" y="122" width="44" height="32" rx="6" fill="#7DD3FC" />
      <rect x="162" y="122" width="44" height="32" rx="6" fill="#38BDF8" />
      <rect x="88" y="176" width="44" height="32" rx="6" fill="#38BDF8" />
      <rect x="162" y="176" width="44" height="32" rx="6" fill="#0EA5E9" />

      {/* Piso / sombra */}
      <ellipse cx="340" cy="352" rx="210" ry="18" fill="#DBEAFE" />

      {/* Cadeira odontológica branca + azul vivo */}
      <path
        d="M210 250c0-42 34-76 76-76h28c42 0 76 34 76 76v18H210v-18Z"
        fill="#FFFFFF"
        stroke="#93C5FD"
        strokeWidth="6"
      />
      <rect x="248" y="188" width="92" height="52" rx="24" fill="#2563EB" />
      <rect x="268" y="158" width="52" height="40" rx="18" fill="#1D4ED8" />
      <rect x="286" y="268" width="28" height="56" rx="8" fill="#60A5FA" />
      <ellipse cx="300" cy="328" rx="46" ry="12" fill="#BFDBFE" />

      {/* Braço articulado + monitor branco */}
      <path
        d="M360 210h88"
        stroke="#3B82F6"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path
        d="M448 210v-42"
        stroke="#3B82F6"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <rect
        x="420"
        y="108"
        width="108"
        height="78"
        rx="12"
        fill="#FFFFFF"
        stroke="#2563EB"
        strokeWidth="5"
      />
      <rect x="436" y="124" width="76" height="10" rx="4" fill="#38BDF8" />
      <rect x="436" y="144" width="54" height="10" rx="4" fill="#93C5FD" />
      <rect x="436" y="164" width="64" height="10" rx="4" fill="#60A5FA" />

      {/* Luminária circular */}
      <circle cx="390" cy="86" r="28" fill="#FFFFFF" stroke="#38BDF8" strokeWidth="6" />
      <circle cx="390" cy="86" r="10" fill="#FACC15" />
      <path
        d="M390 114v28"
        stroke="#60A5FA"
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* Armário branco */}
      <rect
        x="520"
        y="188"
        width="96"
        height="140"
        rx="14"
        fill="#FFFFFF"
        stroke="#93C5FD"
        strokeWidth="5"
      />
      <path d="M536 228h64" stroke="#BFDBFE" strokeWidth="5" strokeLinecap="round" />
      <path d="M536 258h64" stroke="#BFDBFE" strokeWidth="5" strokeLinecap="round" />
      <path d="M536 288h64" stroke="#BFDBFE" strokeWidth="5" strokeLinecap="round" />
      <circle cx="596" cy="214" r="5" fill="#2563EB" />

      {/* Planta viva */}
      <rect x="120" y="286" width="28" height="36" rx="6" fill="#FFFFFF" stroke="#34D399" strokeWidth="4" />
      <ellipse cx="134" cy="268" rx="22" ry="26" fill="#22C55E" />
      <ellipse cx="118" cy="276" rx="14" ry="16" fill="#4ADE80" />

      {/* Profissional (jaleco branco) */}
      <circle cx="470" cy="248" r="20" fill="#FDBA74" />
      <path d="M446 272c10-18 48-18 58 0v42H446V272Z" fill="#FFFFFF" stroke="#93C5FD" strokeWidth="4" />
      <rect x="458" y="292" width="34" height="40" rx="8" fill="#DBEAFE" />
      <path d="M475 334v22" stroke="#64748B" strokeWidth="8" strokeLinecap="round" />
      <circle cx="464" cy="360" r="7" fill="#1E293B" />
      <circle cx="486" cy="360" r="7" fill="#1E293B" />

      {/* Detalhe dente (marca consultório) */}
      <path
        d="M188 292c8-18 28-18 36 0 4 10 2 24-6 34-6 8-18 8-24 0-8-10-10-24-6-34Z"
        fill="#FFFFFF"
        stroke="#2563EB"
        strokeWidth="4"
      />
    </svg>
  );
}
