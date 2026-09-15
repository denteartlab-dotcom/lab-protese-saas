import type { ReactNode } from "react";
import { LoginConsultorioIlustracao } from "@/components/auth/LoginConsultorioIlustracao";

type Props = {
  children: ReactNode;
  marcaTitulo?: string;
  marcaSubtitulo?: string;
  logoSrc?: string;
  logoAlt?: string;
  logoLargura?: number;
  logoAltura?: number;
};

/**
 * Shell split: painel branco/ilustração à esquerda + login em azul claro à direita.
 */
export function LoginAuthShell({
  children,
  marcaTitulo = "Lab Prótese",
  marcaSubtitulo,
  logoSrc,
  logoAlt,
  logoLargura = 40,
  logoAltura = 40,
}: Props) {
  return (
    <div className="login-hero flex min-h-[inherit] flex-1 flex-col bg-[#e8f3fc] lg:flex-row">
      <aside className="relative hidden overflow-hidden bg-white lg:flex lg:w-[58%] lg:flex-col">
        <div
          className="pointer-events-none absolute -left-10 top-16 h-56 w-56 rounded-full bg-sky-100/80"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-8 bottom-8 h-64 w-64 rounded-full bg-blue-100/70"
          aria-hidden
        />

        <div className="relative z-10 flex items-center gap-3 px-8 pb-2 pt-8">
          {logoSrc ? (
            <img
              src={logoSrc}
              alt={logoAlt || marcaTitulo}
              className="object-contain"
              style={{ width: logoLargura, height: logoAltura, maxWidth: 56 }}
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">
              {(marcaTitulo || "L").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-[17px] font-bold tracking-tight text-blue-700">
              {marcaTitulo}
            </p>
            {marcaSubtitulo ? (
              <p className="truncate text-[11px] font-medium uppercase tracking-wide text-slate-400">
                {marcaSubtitulo}
              </p>
            ) : null}
          </div>
        </div>

        <div className="relative z-10 flex flex-1 items-center justify-center px-10 pb-12 pt-4">
          <LoginConsultorioIlustracao className="h-auto w-full max-w-[580px] drop-shadow-sm" />
        </div>
      </aside>

      <main className="relative flex flex-1 items-center justify-center bg-[#e8f3fc] px-5 py-10 sm:px-8">
        <div className="w-full max-w-[380px] rounded-2xl border border-white/80 bg-white/85 p-7 shadow-[0_18px_50px_-28px_rgba(37,99,235,0.35)] backdrop-blur-sm sm:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
