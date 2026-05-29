import {
  parseComplementosInstrucoesGrupo,
  type EtapaOsLinha,
} from "@/lib/etapas-os";
import { STATUS_TRABALHO } from "@/lib/utils";

export type { EtapaOsLinha };

export type TrabalhoModuloOs = {
  id: string;
  numeroOs: number;
  tipoProtese: string;
  valor: number;
  status: string;
  dentes?: string | null;
  cor?: string | null;
  material?: string | null;
  observacoes?: string | null;
  instrucoes?: string | null;
  dataEntrada?: string | null;
  dataPrevista?: string | null;
  cliente?: { nome?: string | null } | null;
  paciente?: { nome?: string | null } | null;
};

export type ItemModuloOs = {
  id: string;
  descricao: string;
  prazo?: string | null;
  qtd: string;
  situacao: string;
  tipo: "trabalho" | "frete" | "produto";
};

export function formatDateModulo(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
}

export function statusModuloOs(status: string) {
  return STATUS_TRABALHO[status] || { label: status, color: "bg-slate-100 text-slate-700" };
}

function tipoItemOs(descricao: string): ItemModuloOs["tipo"] {
  const lower = descricao.toLowerCase();
  if (lower.startsWith("produto:") || lower.includes("produto")) return "produto";
  if (lower.includes("frete") || lower.includes("entrega") || lower.includes("retirada")) {
    return "frete";
  }
  return "trabalho";
}

export function valorLinhaInstrucao(instrucoes: string, prefixo: string) {
  const alvo = prefixo.toLowerCase();
  for (const line of (instrucoes || "").split("\n")) {
    const t = line.trim();
    if (t.toLowerCase().startsWith(alvo)) {
      return t.replace(/^[^:]+:\s*/i, "").trim();
    }
  }
  return "";
}

export function complementosDaOs(trabalhos: { instrucoes?: string | null }[]) {
  return parseComplementosInstrucoesGrupo(
    trabalhos.map((t) => t.instrucoes || "").filter(Boolean)
  );
}

export function itensDaOsModulo(trabalho: TrabalhoModuloOs): ItemModuloOs[] {
  const linhas = (trabalho.instrucoes || "")
    .split("\n")
    .filter((line) => line.trim().startsWith("Item adicionado:"));

  const itens = linhas.map((line, index) => {
    const match = line.match(
      /^Item adicionado:\s*(.*?)\s*-\s*dentes\s*(.*?)\s*-\s*cor\s*(.*?)\s*-\s*qtd\s*(.*?)\s*-\s*valor\s*(.*?)(?:\s*-\s*categoria|\s*-\s*desc|\s*-\s*situação|\s*-\s*produtoId|\s*-\s*urgente|\s*-\s*repetição|\s*-\s*repeticao|\s*-\s*obs|$)/i
    );
    const descricao = match?.[1]?.trim() || trabalho.tipoProtese;
    const situacao =
      line.match(/ - situação (.*?)(?: - produtoId| - urgente| - repetição| - repeticao| - obs|$)/i)?.[1]?.trim() ||
      trabalho.status;

    return {
      id: `${trabalho.id}-${index}`,
      descricao: descricao.replace(/^Produto:\s*/i, ""),
      prazo: trabalho.dataPrevista,
      qtd: match?.[4]?.trim() || "1",
      situacao,
      tipo: tipoItemOs(descricao),
    };
  });

  return itens.length
    ? itens
    : [
        {
          id: `${trabalho.id}-principal`,
          descricao: trabalho.tipoProtese,
          prazo: trabalho.dataPrevista,
          qtd: "1",
          situacao: trabalho.status,
          tipo: tipoItemOs(trabalho.tipoProtese),
        },
      ];
}

function flagsUrgenciaLinhaItem(line: string) {
  return {
    urgente: / - urgente(?: -|$)/i.test(line),
    repeticao: / - repetição(?: -|$)| - repeticao(?: -|$)/i.test(line),
  };
}

function normDescricaoItem(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/^produto:\s*/i, "");
}

/** Urgente/repetição do item na OS (flags em `Item adicionado:` nas instruções). */
export function flagsUrgenciaTrabalho(trabalho: TrabalhoModuloOs) {
  const linhas = (trabalho.instrucoes || "")
    .split("\n")
    .filter((line) => line.trim().startsWith("Item adicionado:"));
  if (!linhas.length) return { urgente: false, repeticao: false };

  const alvo = normDescricaoItem(trabalho.tipoProtese || "");
  const linha =
    linhas.find((line) => {
      const m = line.match(/^Item adicionado:\s*(.*?)\s*-/i);
      const desc = normDescricaoItem(m?.[1] || "");
      return desc === alvo || (alvo.length > 2 && (desc.includes(alvo) || alvo.includes(desc)));
    }) ??
    linhas.find((line) => !/^Item adicionado:\s*produto:/i.test(line)) ??
    linhas[0];

  return flagsUrgenciaLinhaItem(linha);
}

/** Itens de serviço/produto de todos os segmentos da mesma OS. */
export function itensDoGrupoOs(trabalhos: TrabalhoModuloOs[]): ItemModuloOs[] {
  const todos: ItemModuloOs[] = [];
  for (const t of trabalhos) {
    for (const item of itensDaOsModulo(t)) {
      todos.push({
        ...item,
        id: `${t.id}-${item.id}`,
      });
    }
  }
  if (todos.length > 0) return todos;
  return trabalhos[0] ? itensDaOsModulo(trabalhos[0]) : [];
}
