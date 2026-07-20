import {
  colaboradoresParaExibicaoControle,
  nomeEtapaSemSetor,
  parseColaboradoresInstrucoes,
  parseEtapasInstrucoes,
  resumoColaboradorControle,
} from "@/lib/etapas-os";
import {
  dateKeyLocal,
  filtrarTrabalhosAtrasados,
  isTrabalhoAtrasado,
  prazoTrabalho,
} from "@/lib/controle-producao-prazos";

export type TrabalhoAgenda = {
  id: string;
  numeroOs: number;
  tipoProtese: string;
  status: string;
  dataEntrada: string | Date;
  dataPrevista?: string | null | Date;
  instrucoes?: string | null;
  cliente?: { nome?: string | null; ativo?: boolean | null };
  paciente?: { nome?: string | null };
};

export type LinhaAgendaPdf = {
  os: string;
  caixa: string;
  prazo: string;
  qtd: string;
  servico: string;
  cliente: string;
  paciente: string;
  colaborador: string;
  etapas: string;
  prazoOrdenacao: number;
};

export type FiltroAgendaId = "todos" | "atrasados" | `data-${string}`;

function lineValue(instrucoes: string | null | undefined, prefix: string) {
  return (
    (instrucoes || "")
      .split("\n")
      .find((line) => line.trim().startsWith(prefix))
      ?.replace(prefix, "")
      .trim() || ""
  );
}

export function caixaAgenda(instrucoes?: string | null) {
  return lineValue(instrucoes, "Caixa:");
}

export function prazoTextoAgenda(trabalho: TrabalhoAgenda) {
  if (trabalho.dataPrevista) {
    const date = new Date(trabalho.dataPrevista);
    if (!Number.isNaN(date.getTime())) {
      const data = date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      const hora = date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      if (hora !== "00:00") return `${data} ${hora}`;
      return data;
    }
  }

  const match = (trabalho.instrucoes || "").match(
    /Data laboratório:\s*(\d{2}\/\d{2}\/\d{2,4}(?:\s+\d{1,2}:\d{2})?)/i
  );
  if (match?.[1]) return match[1].trim();

  const prazo = prazoTrabalho(trabalho, "lab");
  if (prazo) {
    return prazo.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  return "";
}

export function etapaAtualAgenda(instrucoes?: string | null) {
  const etapas = parseEtapasInstrucoes(instrucoes);
  if (etapas.length === 0) return "Produção";
  const ultima = etapas[etapas.length - 1];
  return nomeEtapaSemSetor(ultima?.nome || "") || "Produção";
}

export function qtdAgenda(instrucoes?: string | null) {
  const match = (instrucoes || "").match(/Item adicionado:.*?-\s*qtd\s*([\d.,]+)/i);
  if (match?.[1]) return match[1].trim();
  return "1";
}

export function colaboradorAgenda(instrucoes?: string | null) {
  const etapas = parseEtapasInstrucoes(instrucoes);
  const colaboradores = colaboradoresParaExibicaoControle(
    parseColaboradoresInstrucoes(instrucoes),
    etapas
  );
  return resumoColaboradorControle(colaboradores);
}

export function mapearLinhaAgendaPdf(trabalho: TrabalhoAgenda): LinhaAgendaPdf {
  const prazoDate = prazoTrabalho(trabalho, "lab");
  return {
    os: String(trabalho.numeroOs),
    caixa: caixaAgenda(trabalho.instrucoes),
    prazo: prazoTextoAgenda(trabalho),
    qtd: qtdAgenda(trabalho.instrucoes),
    servico: trabalho.tipoProtese?.trim() || "",
    cliente: trabalho.cliente?.nome?.trim() || "",
    paciente: trabalho.paciente?.nome?.trim() || "",
    colaborador: colaboradorAgenda(trabalho.instrucoes),
    etapas: etapaAtualAgenda(trabalho.instrucoes),
    prazoOrdenacao: prazoDate ? prazoDate.getTime() : Number.MAX_SAFE_INTEGER,
  };
}

export function filtrarTrabalhosAgenda(
  trabalhos: TrabalhoAgenda[],
  filtro: string,
  cliente?: string
) {
  const base = trabalhos.filter((t) =>
    cliente ? (t.cliente?.nome?.trim() || "") === cliente : true
  );

  if (filtro === "atrasados") {
    return filtrarTrabalhosAtrasados(base, "lab");
  }

  if (filtro.startsWith("data-")) {
    const data = filtro.replace("data-", "");
    return base.filter((trabalho) => {
      const prazo = prazoTrabalho(trabalho, "lab");
      return prazo ? dateKeyLocal(prazo) === data : false;
    });
  }

  return base;
}

export function tituloAgendaPdf(filtro: string) {
  if (filtro === "atrasados") return "Agenda (Atrasados)";
  if (filtro.startsWith("data-")) {
    const [ano, mes, dia] = filtro.replace("data-", "").split("-");
    if (ano && mes && dia) return `Agenda (${dia}/${mes}/${ano})`;
    return "Agenda (Dia)";
  }
  return "Agenda (Todos)";
}

export function ordenarLinhasAgenda(linhas: LinhaAgendaPdf[]) {
  return [...linhas].sort((a, b) => {
    if (a.prazoOrdenacao !== b.prazoOrdenacao) {
      return a.prazoOrdenacao - b.prazoOrdenacao;
    }
    return Number(a.os) - Number(b.os);
  });
}

export function trabalhoAtrasadoAgenda(trabalho: TrabalhoAgenda) {
  return isTrabalhoAtrasado(trabalho, "lab");
}
