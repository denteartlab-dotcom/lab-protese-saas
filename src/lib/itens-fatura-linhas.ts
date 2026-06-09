import type { ItemOsLinha } from "@/lib/trabalho-os-segmento";
import { STATUS_TRABALHO } from "@/lib/utils";

export type TrabalhoItensFatura = {
  id: string;
  numeroOs: number;
  tipoProtese: string;
  status: string;
  instrucoes?: string | null;
  dataPrevista?: string | null;
  dataEntrega?: string | null;
  cliente?: { nome?: string | null; cro?: string | null } | null;
  paciente?: { nome?: string | null } | null;
};

export type LinhaItemFatura = {
  os: number;
  dataEntrega: string;
  qtd: string;
  servicoProduto: string;
  dentista: string;
  paciente: string;
  situacaoLabel: string;
  situacaoClass: string;
};

function primeiroItemLinha(trabalho: TrabalhoItensFatura): ItemOsLinha | null {
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

function qtdItensTrabalho(trabalho: TrabalhoItensFatura) {
  const itens = (trabalho.instrucoes || "")
    .split("\n")
    .filter((line) => line.trim().startsWith("Item adicionado:")).length;
  return itens > 0 ? String(itens) : "1";
}

function situacaoLinha(trabalho: TrabalhoItensFatura) {
  const status = STATUS_TRABALHO[trabalho.status] || STATUS_TRABALHO.pendente;
  return { label: status.label, className: status.color };
}

export function linhasItensFaturaFromTrabalhos(
  trabalhos: TrabalhoItensFatura[],
  formatDate: (iso: string) => string
): LinhaItemFatura[] {
  return trabalhos
    .slice()
    .sort((a, b) => a.numeroOs - b.numeroOs)
    .map((trabalho) => {
      const item = primeiroItemLinha(trabalho);
      const situacao = situacaoLinha(trabalho);
      const dataRef = trabalho.dataEntrega || trabalho.dataPrevista || "";
      return {
        os: trabalho.numeroOs,
        dataEntrega: dataRef ? formatDate(dataRef) : "",
        qtd: qtdItensTrabalho(trabalho),
        servicoProduto: item?.servico || trabalho.tipoProtese,
        dentista: trabalho.cliente?.nome?.trim() || "",
        paciente: trabalho.paciente?.nome?.trim() || "",
        situacaoLabel: situacao.label,
        situacaoClass: situacao.className,
      };
    });
}
