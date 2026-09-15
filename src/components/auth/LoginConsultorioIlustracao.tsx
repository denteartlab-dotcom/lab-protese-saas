/** Ilustração flat minimalista de consultório — painel esquerdo do login. */
export function LoginConsultorioIlustracao({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 640 420"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <circle cx="520" cy="78" r="92" fill="#E8F3FA" />
      <circle cx="112" cy="320" r="70" fill="#EAF7F5" />
      <path
        d="M470 86c18-28 52-28 70 0"
        stroke="#9FD4C8"
        strokeWidth="10"
        strokeLinecap="round"
      />

      {/* Mesa / bancada */}
      <rect x="72" y="248" width="420" height="18" rx="6" fill="#D7E8F4" />
      <rect x="88" y="266" width="28" height="72" rx="4" fill="#C5DCEC" />
      <rect x="448" y="266" width="28" height="72" rx="4" fill="#C5DCEC" />

      {/* Cadeira odontológica */}
      <rect x="168" y="178" width="150" height="70" rx="28" fill="#14B8A6" />
      <rect x="198" y="148" width="78" height="42" rx="20" fill="#0D9488" />
      <rect x="228" y="248" width="36" height="48" rx="8" fill="#99BFD4" />
      <ellipse cx="246" cy="300" rx="42" ry="10" fill="#C9DDEA" />

      {/* Braço / monitor */}
      <path d="M318 168h78" stroke="#94A3B8" strokeWidth="8" strokeLinecap="round" />
      <rect x="386" y="118" width="86" height="64" rx="10" fill="#F8FBFE" stroke="#B7D0E2" strokeWidth="4" />
      <rect x="398" y="132" width="62" height="8" rx="3" fill="#7DD3C7" />
      <rect x="398" y="148" width="44" height="8" rx="3" fill="#CBE4F2" />
      <rect x="398" y="164" width="52" height="8" rx="3" fill="#CBE4F2" />

      {/* Luminária */}
      <path d="M330 96c0-24 20-40 44-40" stroke="#94A3B8" strokeWidth="6" strokeLinecap="round" />
      <circle cx="386" cy="56" r="18" fill="#FDE68A" fillOpacity="0.9" />
      <circle cx="386" cy="56" r="8" fill="#F59E0B" fillOpacity="0.35" />

      {/* Pessoa profissional */}
      <circle cx="430" cy="210" r="22" fill="#F2C4A8" />
      <path d="M404 236c8-16 44-16 52 0v46H404V236Z" fill="#0F766E" />
      <rect x="412" y="248" width="36" height="48" rx="8" fill="#115E59" />
      <path d="M430 282v34" stroke="#0F766E" strokeWidth="10" strokeLinecap="round" />
      <circle cx="418" cy="318" r="8" fill="#334155" />
      <circle cx="442" cy="318" r="8" fill="#334155" />

      {/* Paciente sentado (silhueta suave) */}
      <circle cx="246" cy="132" r="18" fill="#E7B796" />
      <path d="M220 154c10-14 42-14 52 0v28H220V154Z" fill="#64748B" />

      {/* Planta */}
      <rect x="118" y="214" width="22" height="34" rx="4" fill="#99BFD4" />
      <ellipse cx="129" cy="198" rx="18" ry="22" fill="#34D399" />
      <ellipse cx="118" cy="206" rx="12" ry="14" fill="#10B981" />

      {/* Painel / gráficos sutis */}
      <rect x="500" y="168" width="96" height="120" rx="14" fill="#FFFFFF" stroke="#C9DDEA" strokeWidth="3" />
      <rect x="516" y="236" width="12" height="32" rx="3" fill="#5EEAD4" />
      <rect x="536" y="220" width="12" height="48" rx="3" fill="#2DD4BF" />
      <rect x="556" y="208" width="12" height="60" rx="3" fill="#14B8A6" />
      <path d="M516 196h48" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />
      <path d="M516 186c12-10 24 6 36-4 8-6 16 2 24-6" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
