"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Building2,
  Calendar,
  Check,
  Crown,
  Diamond,
  Info,
  LogOut,
  Plane,
  ShieldAlert,
} from "lucide-react";
import type { ContextoAssinaturaVencida } from "@/lib/contexto-assinatura-vencida";
import { RECURSOS_PLANOS_ASSINATURA } from "@/lib/master-planos";
import { cn } from "@/lib/utils";

type Props = {
  contexto: ContextoAssinaturaVencida;
};

const ICONES_PLANO = {
  basico: Plane,
  profissional: Crown,
  premium: Diamond,
} as const;

export function AssinaturaVencidaPainel({ contexto }: Props) {
  const router = useRouter();
  const whatsapp = (contexto.suporteWhatsapp || "").replace(/\D/g, "");
  const linkWhatsapp = whatsapp
    ? `https://wa.me/55${whatsapp}?text=${encodeURIComponent(
        "Olá, preciso de ajuda para renovar minha assinatura do Lab Prótese."
      )}`
    : null;

  async function sair() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    window.location.assign("/login");
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-center gap-2 px-4 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0066FF]/10 text-[#0066FF]">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-slate-900">DenteArt</p>
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Laboratório</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Assinatura vencida</h1>
          <p className="mt-2 text-sm text-slate-600">
            Sua assinatura expirou. Escolha um plano para continuar usando o sistema.
          </p>
        </div>

        <div className="mb-8 rounded-2xl border border-red-100 bg-red-50 px-4 py-4 sm:px-5">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <p className="text-sm text-red-800">
              Seu acesso ao sistema está temporariamente bloqueado até a regularização da
              assinatura.
            </p>
          </div>
        </div>

        <section className="mb-8 grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Laboratório
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              <Building2 className="h-4 w-4 text-slate-400" />
              {contexto.empresa.nome}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Plano atual
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              <Crown className="h-4 w-4 text-slate-400" />
              {contexto.empresa.planoRotulo}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Data de vencimento
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              <Calendar className="h-4 w-4 text-slate-400" />
              {contexto.empresa.dataVencimentoFormatada}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Status
            </p>
            <p className="mt-1 text-sm font-bold text-red-600">Vencido</p>
          </div>
        </section>

        <section className="mb-8">
          <div className="mb-5 text-center">
            <h2 className="text-lg font-bold text-slate-900">Escolha seu plano</h2>
            <p className="mt-1 text-sm text-slate-600">
              Renove agora e volte a usar o sistema sem interrupções.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {RECURSOS_PLANOS_ASSINATURA.map((plano) => {
              const Icone = ICONES_PLANO[plano.id];
              const atual = contexto.empresa.plano === plano.id;
              return (
                <div
                  key={plano.id}
                  className={cn(
                    "relative flex flex-col rounded-2xl border-2 bg-white p-5 shadow-sm",
                    plano.destaque ? "border-[#0066FF]" : "border-slate-200"
                  )}
                >
                  {plano.destaque ? (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#0066FF] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      {plano.destaqueRotulo}
                    </span>
                  ) : null}

                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-[#0066FF]">
                        <Icone className="h-5 w-5" />
                      </div>
                      <h3 className="text-base font-bold text-slate-900">{plano.nome}</h3>
                      <p className="mt-1 text-xl font-bold text-slate-900">{plano.precoLabel}</p>
                    </div>
                    {atual ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        Atual
                      </span>
                    ) : null}
                  </div>

                  <ul className="mb-5 flex-1 space-y-2">
                    {plano.itens.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#0066FF]" />
                        {item}
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => router.push(`/pagamento?plano=${plano.id}`)}
                    className={cn(
                      "h-10 w-full rounded-lg text-sm font-semibold transition",
                      plano.destaque
                        ? "bg-[#0066FF] text-white hover:bg-[#0052cc]"
                        : "border border-[#0066FF] text-[#0066FF] hover:bg-blue-50"
                    )}
                  >
                    Renovar {plano.nome}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <div className="mb-8 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#0066FF]" />
            <p className="text-sm text-blue-900">
              Ao renovar sua assinatura, você será redirecionado para a página de pagamento seguro.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          {linkWhatsapp ? (
            <a
              href={linkWhatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <span className="text-[#25D366]">WhatsApp</span>
              Falar com suporte no WhatsApp
            </a>
          ) : (
            <Link
              href="/suporte"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Falar com suporte
            </Link>
          )}
          <button
            type="button"
            onClick={() => void sair()}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-100 bg-white px-5 text-sm font-medium text-red-600 shadow-sm hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Sair da conta
          </button>
        </div>
      </main>
    </div>
  );
}
