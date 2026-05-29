"use client";

import {
  situacaoExibicaoTrabalho,
  type ItemOsLinha,
} from "@/lib/trabalho-os-segmento";
import { STATUS_TRABALHO } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type TrabalhoSituacaoBadge = {
  id: string;
  numeroOs: number;
  tipoProtese: string;
  status: string;
  instrucoes?: string | null;
  segmentoFaturamento?: string | null;
};

function primeiroItemLinhaReceita(trabalho: TrabalhoSituacaoBadge): ItemOsLinha | null {
  const lines = (trabalho.instrucoes || "").split("\n");
  for (const line of lines) {
    const t = line.trim();
    if (!t.startsWith("Item adicionado:")) continue;
    const match = t.match(/^Item adicionado:\s*(.*?)\s*-\s*dentes\s/i);
    const servico = match?.[1]?.trim() || trabalho.tipoProtese;
    const produtoId = t
      .match(/ - produtoId (.*?)(?: - urgente| - repetição| - repeticao| - obs|$)/i)?.[1]
      ?.trim();
    return { servico, produtoId: produtoId || undefined };
  }
  return { servico: trabalho.tipoProtese };
}

export function labelSituacaoOsReceita(trabalho: TrabalhoSituacaoBadge) {
  const exibicao = situacaoExibicaoTrabalho(
    trabalho,
    primeiroItemLinhaReceita(trabalho) ?? undefined
  );
  if (exibicao.kind === "produto") return "Produto";
  if (exibicao.kind === "transporte") return "Transporte";
  return STATUS_TRABALHO[trabalho.status]?.label || trabalho.status;
}

export function SituacaoOsBadgeReceita({ trabalho }: { trabalho: TrabalhoSituacaoBadge }) {
  const exibicao = situacaoExibicaoTrabalho(
    trabalho,
    primeiroItemLinhaReceita(trabalho) ?? undefined
  );

  if (exibicao.kind === "produto") {
    return (
      <span className="inline-flex items-center rounded-full bg-[#4b5563] px-2.5 py-0.5 text-[10px] font-semibold text-white">
        Produto
      </span>
    );
  }
  if (exibicao.kind === "transporte") {
    return (
      <span className="inline-flex items-center rounded-full bg-[#6b7280] px-2.5 py-0.5 text-[10px] font-semibold text-white">
        Transporte
      </span>
    );
  }

  const status = trabalho.status;
  const label = STATUS_TRABALHO[status]?.label || status;
  const pillClass =
    status === "entregue"
      ? "bg-[#22c55e] text-white"
      : status === "finalizado"
        ? "bg-[#2563eb] text-white"
        : STATUS_TRABALHO[status]?.color || "bg-slate-100 text-slate-700";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
        pillClass
      )}
    >
      {label}
    </span>
  );
}
