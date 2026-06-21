"use client";

import { cn } from "@/lib/utils";
import type { MockupTelaId } from "@/lib/landing-content";

type Props = {
  variant?: "hero" | "destaque";
  telaNotebook?: MockupTelaId;
  telaCelular?: MockupTelaId;
  className?: string;
};

function TelaDashboard({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("space-y-2 p-2", compact ? "p-1.5" : "p-3")}>
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { l: "Trabalhos", v: "128", c: "bg-indigo-500" },
          { l: "Produção", v: "42", c: "bg-violet-500" },
          { l: "Receber", v: "R$ 18k", c: "bg-sky-500" },
        ].map((card) => (
          <div
            key={card.l}
            className={cn("rounded-md p-1.5 text-white", card.c, compact && "p-1")}
          >
            <p className={cn("opacity-80", compact ? "text-[6px]" : "text-[8px]")}>{card.l}</p>
            <p className={cn("font-bold", compact ? "text-[8px]" : "text-[10px]")}>{card.v}</p>
          </div>
        ))}
      </div>
      <div className="rounded-md bg-slate-100 p-1.5">
        <div className="mb-1 h-1.5 w-1/3 rounded bg-slate-300" />
        <div className="space-y-1">
          {[72, 48, 86, 55].map((w, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="h-1 flex-1 rounded bg-slate-200" style={{ maxWidth: `${w}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TelaTrabalhos({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("p-2", compact ? "p-1.5" : "p-3")}>
      <div className="mb-1.5 flex gap-1">
        <div className="h-2 flex-1 rounded bg-indigo-100" />
        <div className="h-2 w-6 rounded bg-violet-500" />
      </div>
      <div className="space-y-1">
        {["#2841 · Coroa", "#2840 · Prótese", "#2839 · Faceta"].map((row, i) => (
          <div
            key={row}
            className={cn(
              "flex items-center justify-between rounded border border-slate-100 bg-white px-1.5 py-1",
              compact && "py-0.5"
            )}
          >
            <span className={cn("font-medium text-slate-700", compact ? "text-[7px]" : "text-[8px]")}>
              {row}
            </span>
            <span
              className={cn(
                "rounded-full px-1 py-0.5 text-white",
                i === 0 ? "bg-amber-400" : i === 1 ? "bg-sky-500" : "bg-emerald-500",
                compact ? "text-[6px]" : "text-[7px]"
              )}
            >
              {i === 0 ? "Produção" : i === 1 ? "Modelagem" : "Entrega"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TelaProducao({ compact = false }: { compact?: boolean }) {
  const cols = [
        { t: "Recebido", n: 3, c: "bg-slate-400" },
        { t: "Modelagem", n: 5, c: "bg-sky-500" },
        { t: "Cerâmica", n: 2, c: "bg-violet-500" },
      ];
  return (
    <div className={cn("p-2", compact ? "p-1.5" : "p-3")}>
      <div className="grid grid-cols-3 gap-1">
        {cols.map((col) => (
          <div key={col.t} className="rounded bg-slate-50 p-1">
            <p className={cn("mb-1 font-semibold text-slate-600", compact ? "text-[6px]" : "text-[7px]")}>
              {col.t}
            </p>
            {Array.from({ length: col.n > 2 ? 2 : col.n }).map((_, i) => (
              <div
                key={i}
                className={cn("mb-0.5 rounded px-1 py-0.5 text-white", col.c, compact ? "text-[6px]" : "text-[7px]")}
              >
                OS {2840 + i}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function TelaFinanceiro({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("p-2", compact ? "p-1.5" : "p-3")}>
      <div className="mb-2 flex items-end gap-0.5">
        {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-gradient-to-t from-indigo-600 to-violet-400"
            style={{ height: compact ? h / 3 : h / 2 }}
          />
        ))}
      </div>
      <div className="space-y-1">
        {["A receber · R$ 12.450", "Recebido · R$ 8.200"].map((linha) => (
          <div
            key={linha}
            className={cn(
              "flex justify-between rounded bg-slate-50 px-1.5 py-0.5 text-slate-600",
              compact ? "text-[6px]" : "text-[7px]"
            )}
          >
            {linha}
          </div>
        ))}
      </div>
    </div>
  );
}

function TelaRelatorios({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("flex gap-2 p-2", compact ? "p-1.5" : "p-3")}>
      <div
        className={cn(
          "relative shrink-0 rounded-full border-[3px] border-indigo-500 border-r-violet-300 border-b-sky-400",
          compact ? "h-10 w-10" : "h-14 w-14"
        )}
      />
      <div className="flex-1 space-y-1">
        {["Margem por cliente", "Tempo de produção", "Curva ABC"].map((item) => (
          <div key={item} className="flex items-center gap-1">
            <div className="h-1 w-1 rounded-full bg-indigo-500" />
            <span className={cn("text-slate-600", compact ? "text-[6px]" : "text-[7px]")}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConteudoTela({ id, compact }: { id: MockupTelaId; compact?: boolean }) {
  switch (id) {
    case "dashboard":
      return <TelaDashboard compact={compact} />;
    case "trabalhos":
      return <TelaTrabalhos compact={compact} />;
    case "producao":
      return <TelaProducao compact={compact} />;
    case "financeiro":
      return <TelaFinanceiro compact={compact} />;
    case "relatorios":
      return <TelaRelatorios compact={compact} />;
  }
}

export function LandingMockups({
  variant = "hero",
  telaNotebook = "dashboard",
  telaCelular = "producao",
  className,
}: Props) {
  const grande = variant === "destaque";

  return (
    <div
      className={cn(
        "relative mx-auto flex items-end justify-center",
        grande ? "max-w-3xl" : "max-w-2xl",
        className
      )}
    >
      {/* Notebook */}
      <div
        className={cn(
          "relative z-10 w-full",
          grande ? "max-w-[520px]" : "max-w-[420px]"
        )}
      >
        <div className="rounded-t-xl border border-slate-200/80 bg-slate-800 p-1.5 shadow-2xl shadow-indigo-900/20">
          <div className="overflow-hidden rounded-lg bg-white">
            <div className="flex items-center gap-1 border-b border-slate-100 bg-slate-50 px-2 py-1">
              <div className="flex gap-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </div>
              <div className="mx-auto h-1.5 w-24 rounded-full bg-slate-200" />
            </div>
            <div className={cn(grande ? "min-h-[200px]" : "min-h-[160px]")}>
              <ConteudoTela id={telaNotebook} />
            </div>
          </div>
        </div>
        <div className="mx-auto h-2 w-[92%] rounded-b-lg bg-slate-700" />
        <div className="mx-auto h-1 w-[70%] rounded-b-xl bg-slate-600" />
      </div>

      {/* Celular */}
      <div
        className={cn(
          "absolute z-20 rounded-[1.25rem] border-[3px] border-slate-800 bg-slate-800 shadow-2xl shadow-indigo-900/30",
          grande
            ? "-right-2 bottom-4 w-[130px] sm:-right-6 sm:w-[150px]"
            : "-right-1 bottom-2 w-[100px] sm:-right-4 sm:w-[120px]"
        )}
      >
        <div className="mx-auto mt-1.5 h-1 w-8 rounded-full bg-slate-600" />
        <div className="m-1 overflow-hidden rounded-[0.9rem] bg-white">
          <div className={cn(grande ? "min-h-[170px]" : "min-h-[130px]")}>
            <ConteudoTela id={telaCelular} compact />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Grade de mini-telas para o hero — mostra as 5 áreas do sistema. */
export function LandingMockupShowcase() {
  const telas: MockupTelaId[] = ["dashboard", "trabalhos", "producao", "financeiro", "relatorios"];
  const labels = ["Dashboard", "Trabalhos", "Produção", "Financeiro", "Relatórios"];

  return (
    <div className="landing-fade-in-up mx-auto w-full max-w-4xl px-4 delay-200">
      <LandingMockups variant="hero" telaNotebook="dashboard" telaCelular="producao" />
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        {telas.map((id, i) => (
          <span
            key={id}
            className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm"
          >
            {labels[i]}
          </span>
        ))}
      </div>
    </div>
  );
}
