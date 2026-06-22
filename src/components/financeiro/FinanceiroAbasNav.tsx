"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { analisarCaminhoApp, montarCaminhoAppComSlug } from "@/lib/rotas-app";
import { cn } from "@/lib/utils";

const abas = [
  { query: "tipo=receita", label: "Contas a Receber", id: "receber" },
  { query: "aba=boletos", label: "Controle de Boletos", id: "boletos" },
  { query: "tipo=despesa", label: "Contas a Pagar", id: "pagar" },
] as const;

function abaAtiva(searchParams: URLSearchParams) {
  if (searchParams.get("aba") === "boletos") return "boletos";
  if (
    searchParams.get("tipo") === "despesa" ||
    searchParams.get("aba") === "pagar" ||
    searchParams.get("acao") === "pagar"
  ) {
    return "pagar";
  }
  return "receber";
}

function pathnameEhFinanceiro(pathname: string) {
  return pathname === "/app/financeiro" || /\/financeiro$/.test(pathname);
}

function baseFinanceiro(pathname: string) {
  const { slug } = analisarCaminhoApp(pathname);
  if (slug) return montarCaminhoAppComSlug(slug, "/financeiro");
  return "/app/financeiro";
}

export function FinanceiroAbasNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ativa = abaAtiva(searchParams);

  if (!pathnameEhFinanceiro(pathname)) return null;

  const base = baseFinanceiro(pathname);

  return (
    <div className="mb-6 flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50/80 p-1">
      {abas.map((aba) => (
        <Link
          key={aba.id}
          href={`${base}?${aba.query}`}
          className={cn(
            "rounded-lg px-4 py-2 text-[13px] font-medium transition",
            ativa === aba.id
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          {aba.label}
        </Link>
      ))}
    </div>
  );
}
