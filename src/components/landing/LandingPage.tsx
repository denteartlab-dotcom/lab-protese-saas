"use client";

import { Check, MessageCircle, Play } from "lucide-react";
import type { ReactNode } from "react";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import {
  LandingMockupShowcase,
  LandingMockups,
} from "@/components/landing/LandingMockups";
import {
  BENEFICIOS_LANDING,
  FUNCIONALIDADES_LANDING,
  WHATSAPP_LANDING_URL,
} from "@/lib/landing-content";
import { recursosPlanosAssinatura } from "@/lib/master-planos";
import { cn } from "@/lib/utils";

function OndaBranca({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute bottom-0 left-0 w-full overflow-hidden leading-[0]", className)}>
      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="relative block h-[60px] w-full sm:h-[90px] lg:h-[110px]"
        aria-hidden
      >
        <path
          d="M0,64 C240,120 480,0 720,48 C960,96 1200,32 1440,64 L1440,120 L0,120 Z"
          fill="#ffffff"
        />
      </svg>
    </div>
  );
}

function BotaoWhatsapp({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <a
      href={WHATSAPP_LANDING_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl border-2 border-white/40 bg-white/10 px-6 py-3.5 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/20",
        className
      )}
    >
      <MessageCircle className="h-4 w-4" />
      {children}
    </a>
  );
}

export function LandingPage() {
  const planos = recursosPlanosAssinatura("mensal");

  return (
    <div className="landing-page min-h-screen bg-white text-slate-800">
      <LandingHeader />

      {/* Hero */}
      <section
        id="inicio"
        className="landing-gradient-hero relative overflow-hidden pb-28 pt-24 sm:pb-36 sm:pt-28 lg:pb-40 lg:pt-32"
      >
        <div className="landing-hero-glow pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h1 className="landing-fade-in-up text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
            Software de gestão para laboratórios de prótese odontológica
          </h1>
          <p className="landing-fade-in-up mx-auto mt-5 max-w-2xl text-base leading-relaxed text-indigo-100 delay-100 sm:text-lg">
            Organize trabalhos, produção, financeiro, clientes e entregas em uma
            única plataforma.
          </p>
          <div className="landing-fade-in-up mt-8 flex flex-col items-center justify-center gap-3 delay-150 sm:flex-row sm:gap-4">
            <a
              href="/cadastro"
              className="inline-flex w-full max-w-xs items-center justify-center rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-600 sm:w-auto"
            >
              Começar teste grátis por 14 dias
            </a>
            <BotaoWhatsapp className="w-full max-w-xs sm:w-auto">
              Falar no WhatsApp
            </BotaoWhatsapp>
          </div>
        </div>

        <div className="relative mt-12 sm:mt-16">
          <LandingMockupShowcase />
        </div>

        <OndaBranca />
      </section>

      {/* Sobre */}
      <section id="sobre" className="scroll-mt-20 bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
            Sobre o Sistema Lab Prótese
          </h2>
          <div className="mt-12 grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="landing-fade-in-up relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-100 to-indigo-50 shadow-xl">
              <div className="aspect-video flex items-center justify-center p-6">
                <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-white/60 bg-white shadow-lg">
                  <LandingMockups
                    variant="hero"
                    telaNotebook="trabalhos"
                    telaCelular="dashboard"
                    className="scale-90 py-4"
                  />
                </div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/5">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg">
                  <Play className="ml-0.5 h-6 w-6" fill="currentColor" />
                </div>
              </div>
            </div>
            <div className="landing-fade-in-up delay-100">
              <p className="text-base leading-relaxed text-slate-600 sm:text-lg">
                O Lab Prótese foi criado para simplificar a gestão de laboratórios
                protéticos, centralizando produção, financeiro, clientes, trabalhos
                e relatórios em uma plataforma moderna e fácil de usar.
              </p>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                Do recebimento da OS à entrega final, sua equipe ganha visibilidade
                completa do fluxo de trabalho, enquanto dentistas acompanham prazos
                e status pelo portal do cliente.
              </p>
              <a
                href="/cadastro"
                className="mt-8 inline-flex items-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-700"
              >
                Saiba mais — teste grátis
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Benefícios */}
      <section className="bg-slate-50 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
            Potencialize o crescimento do seu laboratório
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600">
            Ferramentas pensadas para o dia a dia de laboratórios protéticos de
            todos os portes.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFICIOS_LANDING.map(({ titulo, descricao, Icon }, i) => (
              <article
                key={titulo}
                className="landing-fade-in-up group rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/30">
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">{titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{descricao}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Destaque funcionalidades */}
      <section
        id="funcionalidades"
        className="landing-gradient-band relative scroll-mt-20 overflow-hidden py-16 sm:py-24"
      >
        <div className="landing-hero-glow pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 className="text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
                Conheça as ferramentas que vão transformar sua gestão
              </h2>
              <ul className="mt-8 space-y-4">
                {FUNCIONALIDADES_LANDING.map(({ titulo, Icon }) => (
                  <li key={titulo} className="flex items-center gap-3 text-white/95">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">
                      <Icon className="h-5 w-5" strokeWidth={2} />
                    </span>
                    <span className="text-base font-medium sm:text-lg">{titulo}</span>
                  </li>
                ))}
              </ul>
              <a
                href="/cadastro"
                className="mt-10 inline-flex rounded-xl bg-white px-6 py-3 text-sm font-bold text-indigo-700 shadow-lg transition hover:bg-indigo-50"
              >
                Experimentar gratuitamente
              </a>
            </div>
            <div className="landing-fade-in-up">
              <LandingMockups
                variant="destaque"
                telaNotebook="financeiro"
                telaCelular="relatorios"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="scroll-mt-20 bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
            Planos para cada fase do seu laboratório
          </h2>
          <p className="mt-3 text-center text-indigo-600 font-semibold">
            Teste grátis por 14 dias
          </p>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {planos.map((plano) => (
              <article
                key={plano.id}
                className={cn(
                  "relative flex flex-col rounded-2xl border p-6 shadow-sm transition hover:shadow-md",
                  plano.destaque
                    ? "border-indigo-300 bg-gradient-to-b from-indigo-50/80 to-white ring-2 ring-indigo-500/20"
                    : "border-slate-200 bg-white"
                )}
              >
                {plano.destaqueRotulo && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    {plano.destaqueRotulo}
                  </span>
                )}
                <h3 className="text-xl font-bold text-slate-900">{plano.nome}</h3>
                <p className="mt-2 text-2xl font-extrabold text-indigo-600">
                  {plano.precoLabel}
                </p>
                <p className="mt-1 text-sm text-slate-500">Teste grátis por 14 dias</p>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {plano.itens.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/cadastro"
                  className={cn(
                    "mt-8 block rounded-xl py-3 text-center text-sm font-bold transition",
                    plano.destaque
                      ? "bg-indigo-600 text-white hover:bg-indigo-700"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                  )}
                >
                  Começar agora
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="landing-gradient-hero relative overflow-hidden py-16 sm:py-20">
        <div className="landing-hero-glow pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Comece hoje a organizar seu laboratório
          </h2>
          <p className="mt-4 text-base text-indigo-100 sm:text-lg">
            Teste o Lab Prótese gratuitamente por 14 dias.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <a
              href="/cadastro"
              className="inline-flex w-full max-w-xs items-center justify-center rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-emerald-600 sm:w-auto"
            >
              Criar conta grátis
            </a>
            <BotaoWhatsapp className="w-full max-w-xs sm:w-auto">
              Falar no WhatsApp
            </BotaoWhatsapp>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
