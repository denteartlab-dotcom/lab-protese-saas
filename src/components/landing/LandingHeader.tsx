"use client";

import { Menu, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { LogoMarcaDenteArt } from "@/components/LogoMarcaDenteArt";
import { LANDING_NAV } from "@/lib/landing-content";
import { cn } from "@/lib/utils";

function scrollPara(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function LandingHeader() {
  const [fixo, setFixo] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    const onScroll = () => setFixo(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const ir = useCallback((id: string) => {
    setMenuAberto(false);
    scrollPara(id);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        fixo
          ? "border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-md"
          : "bg-transparent"
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => ir("inicio")}
          className="shrink-0 rounded-lg outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-indigo-400"
          aria-label="Lab Prótese — Início"
        >
          <div
            className={cn(
              "rounded-lg px-2 py-1 transition",
              fixo ? "bg-transparent" : "bg-white/95 shadow-sm backdrop-blur-sm"
            )}
          >
            <LogoMarcaDenteArt variant="topo" className="!h-10 !w-auto max-w-[180px] sm:max-w-[220px]" />
          </div>
        </button>

        <nav
          className="hidden items-center gap-6 lg:flex"
          aria-label="Navegação principal"
        >
          {LANDING_NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => ir(item.id)}
              className={cn(
                "text-sm font-medium transition hover:opacity-80",
                fixo ? "text-slate-700 hover:text-indigo-600" : "text-white/95 hover:text-white"
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          <a
            href="/login"
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold transition",
              fixo
                ? "text-slate-700 hover:bg-slate-100"
                : "text-white hover:bg-white/10"
            )}
          >
            Entrar
          </a>
          <a
            href="/cadastro"
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-bold shadow-lg transition",
              fixo
                ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/20"
                : "bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-900/25"
            )}
          >
            Teste grátis
          </a>
        </div>

        <button
          type="button"
          className={cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-lg lg:hidden",
            fixo ? "text-slate-700 hover:bg-slate-100" : "text-white hover:bg-white/10"
          )}
          onClick={() => setMenuAberto((v) => !v)}
          aria-expanded={menuAberto}
          aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
        >
          {menuAberto ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {menuAberto && (
        <div className="border-t border-slate-200/80 bg-white px-4 py-4 shadow-lg lg:hidden">
          <nav className="flex flex-col gap-1">
            {LANDING_NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => ir(item.id)}
                className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4">
            <a
              href="/login"
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-center text-sm font-semibold text-slate-700"
              onClick={() => setMenuAberto(false)}
            >
              Entrar
            </a>
            <a
              href="/cadastro"
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-center text-sm font-bold text-white"
              onClick={() => setMenuAberto(false)}
            >
              Teste grátis
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
