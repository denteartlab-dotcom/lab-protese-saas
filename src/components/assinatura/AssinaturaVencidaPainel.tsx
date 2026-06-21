"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertCircle,
  Building2,
  Calendar,
  Check,
  Crown,
  Diamond,
  Info,
  Lock,
  LogOut,
  MessageCircle,
  Plane,
  XCircle,
} from "lucide-react";
import type { ContextoAssinaturaVencida } from "@/lib/contexto-assinatura-vencida";
import type { LabBrandingPublico } from "@/lib/lab-branding";
import { dimensoesLogoPx } from "@/lib/lab-logo";
import {
  recursosPlanosAssinatura,
  type PeriodoCobranca,
} from "@/lib/master-planos";
import { cn } from "@/lib/utils";
import { SeletorPeriodoCobranca } from "@/components/assinatura/SeletorPeriodoCobranca";

type Props = {
  contexto: ContextoAssinaturaVencida;
  branding: LabBrandingPublico;
};

const ICONES_PLANO = {
  basico: Plane,
  profissional: Crown,
  premium: Diamond,
} as const;

export function AssinaturaVencidaPainel({ contexto, branding }: Props) {
  const router = useRouter();
  const [periodo, setPeriodo] = useState<PeriodoCobranca>(
    contexto.periodoCobrancaPreferido ?? "mensal"
  );
  const planos = recursosPlanosAssinatura(periodo);
  const logo = dimensoesLogoPx(
    {
      marca: branding.nomeLaboratorio,
      marcaSubtitulo: branding.marcaSubtitulo,
      responsavel: "",
      endereco: "",
      enderecoLinha1: "",
      enderecoLinha2: "",
      telefones: "",
      email: "",
      logoDataUrl: branding.logoDataUrl,
      logoTamanho: branding.logoTamanho,
    },
    { largura: 40, altura: 40 }
  );

  const whatsapp = (contexto.suporteWhatsapp || "").replace(/\D/g, "");
  const linkWhatsapp = whatsapp
    ? `https://wa.me/55${whatsapp}?text=${encodeURIComponent(
        "Olá, preciso de ajuda para renovar minha assinatura do DenteArt."
      )}`
    : null;

  async function sair() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    window.location.assign("/login");
  }

  const statusRotulo =
    contexto.empresa.statusPagamento === "VENCIDO"
      ? "Vencido"
      : contexto.empresa.statusPagamento === "PENDENTE"
        ? "Pendente"
        : "Bloqueado";

  const ehNovaConta = contexto.empresa.statusPagamento === "PENDENTE";
  const tituloPagina = ehNovaConta ? "Ative sua assinatura" : "Assinatura vencida";
  const subtituloPagina = ehNovaConta
    ? "Escolha um plano e pague com PIX para liberar o acesso ao sistema."
    : "Sua assinatura expirou. Escolha um plano para continuar usando o sistema.";
  const avisoBloqueio = ehNovaConta
    ? "Seu acesso ao sistema será liberado automaticamente após a confirmação do pagamento."
    : "Seu acesso ao sistema está temporariamente bloqueado até a regularização da assinatura.";

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-center px-4 py-5">
          <div className="flex items-center gap-3">
            {branding.logoDataUrl?.trim() ? (
              <img
                src={branding.logoDataUrl}
                alt=""
                width={logo.largura}
                height={logo.altura}
                className="rounded-lg object-contain"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0066FF] text-lg text-white">
                🦷
              </div>
            )}
            <div className="text-left">
              <p className="text-sm font-bold text-slate-900">
                {branding.nomeLaboratorio || "DenteArt"}
              </p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                {branding.marcaSubtitulo || "Laboratório"}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex items-center justify-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertCircle className="h-6 w-6" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{tituloPagina}</h1>
          </div>
          <p className="text-sm text-slate-600">{subtituloPagina}</p>
        </div>

        <div className="mb-8 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 sm:px-5">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <p className="text-sm text-red-800">{avisoBloqueio}</p>
          </div>
        </div>

        <section className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
            <div className="px-4 py-4 sm:px-5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Laboratório
              </p>
              <p className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Building2 className="h-4 w-4 text-slate-400" />
                {contexto.empresa.nome}
              </p>
            </div>
            <div className="px-4 py-4 sm:px-5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Plano atual
              </p>
              <p className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Crown className="h-4 w-4 text-slate-400" />
                {contexto.empresa.planoRotulo}
              </p>
            </div>
            <div className="px-4 py-4 sm:px-5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Data de vencimento
              </p>
              <p className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-red-600">
                <Calendar className="h-4 w-4 text-red-400" />
                {contexto.empresa.dataVencimentoFormatada}
              </p>
            </div>
            <div className="px-4 py-4 sm:px-5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Status
              </p>
              <p className="mt-1.5 flex items-center gap-2 text-sm font-bold text-red-600">
                <XCircle className="h-4 w-4" />
                {statusRotulo}
              </p>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <div className="mb-5 flex flex-col items-center gap-3 text-center">
            <h2 className="text-lg font-bold text-slate-900">Escolha seu plano</h2>
            <p className="text-sm text-slate-600">
              {ehNovaConta
                ? "Pague com PIX e comece a usar o sistema imediatamente."
                : "Renove agora e volte a usar o sistema sem interrupções."}
            </p>
            <SeletorPeriodoCobranca periodo={periodo} onChange={setPeriodo} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {planos.map((plano) => {
              const Icone = ICONES_PLANO[plano.id];
              return (
                <div
                  key={plano.id}
                  className={cn(
                    "relative flex flex-col rounded-2xl border-2 bg-white p-5 shadow-sm",
                    plano.destaque ? "border-[#0066FF] shadow-md" : "border-slate-200"
                  )}
                >
                  {plano.destaque ? (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#0066FF] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      {plano.destaqueRotulo}
                    </span>
                  ) : null}

                  {plano.descontoAnualLabel ? (
                    <span className="absolute right-3 top-3 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                      {plano.descontoAnualLabel}
                    </span>
                  ) : null}

                  <div className="mb-4">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#0066FF]">
                      <Icone className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900">{plano.nome}</h3>
                    <div className="mt-2">
                      {plano.precoCheioAnualLabel ? (
                        <p className="text-sm text-slate-400 line-through">
                          {plano.precoCheioAnualLabel}
                        </p>
                      ) : null}
                      <p className="text-2xl font-bold text-slate-900">{plano.precoLabel}</p>
                    </div>
                  </div>

                  <ul className="mb-5 flex-1 space-y-2.5">
                    {plano.itens.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#0066FF]" />
                        {item}
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/pagamento?plano=${plano.id}&periodo=${periodo}`)
                    }
                    className={cn(
                      "h-10 w-full rounded-lg text-sm font-semibold transition",
                      plano.destaque
                        ? "bg-[#0066FF] text-white hover:bg-[#0052cc]"
                        : "border border-[#0066FF] text-[#0066FF] hover:bg-blue-50"
                    )}
                  >
                    Renovar {plano.nome}
                    {periodo === "anual" ? " (Anual)" : ""}
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

        <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          {linkWhatsapp ? (
            <a
              href={linkWhatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-[#25D366] bg-white px-5 text-sm font-semibold text-[#25D366] shadow-sm hover:bg-green-50 sm:max-w-xs"
            >
              <MessageCircle className="h-4 w-4" />
              Falar com suporte no WhatsApp
            </a>
          ) : (
            <Link
              href="/suporte"
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 sm:max-w-xs"
            >
              Falar com suporte
            </Link>
          )}
          <button
            type="button"
            onClick={() => void sair()}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-5 text-sm font-semibold text-red-600 shadow-sm hover:bg-red-50 sm:max-w-xs"
          >
            <LogOut className="h-4 w-4" />
            Sair da conta
          </button>
        </div>
      </main>
    </div>
  );
}
