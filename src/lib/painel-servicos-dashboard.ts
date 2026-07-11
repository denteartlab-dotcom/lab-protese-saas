import {
  caixaDeInstrucoes,
  formatDiaMesBr,
  prazoTrabalho,
  type TipoPrazoProducao,
} from "@/lib/controle-producao-prazos";
import type { Locale } from "@/lib/i18n";
import { localeDataIntl } from "@/lib/i18n/tr-ui";
import {
  colaboradoresParaExibicaoControle,
  parseComplementosInstrucoesGrupo,
  resumoColaboradorControle,
} from "@/lib/etapas-os";
import { STATUS_TRABALHO } from "@/lib/utils";

export type TrabalhoPainelServicos = {
  id: string;
  numeroOs: number;
  grupoOsId?: string | null;
  segmentoFaturamento?: string | null;
  tipoProtese: string;
  status: string;
  dataEntrada: string;
  dataPrevista: string | null;
  instrucoes?: string | null;
  cliente: { nome: string };
  paciente: { nome: string };
};

export type GrupoOsPainelServicos = {
  chave: string;
  idPrincipal: string;
  numeroOs: number;
  clienteNome: string;
  pacienteNome: string;
  servicos: string[];
  status: string;
  situacao: string;
  colaborador: string;
  prazoLab: string;
  prazoDent: string;
  caixa: string;
  dataExibicao: string;
  trabalhos: TrabalhoPainelServicos[];
};

function chaveGrupoOs(trabalho: TrabalhoPainelServicos) {
  if (trabalho.grupoOsId) return trabalho.grupoOsId;
  const paciente = trabalho.paciente?.nome?.trim() || "";
  return `os-${trabalho.numeroOs}-${paciente}`;
}

function formatDataCompleta(date: Date) {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function dataExibicaoGrupo(trabalho: TrabalhoPainelServicos, tipoPrazo: TipoPrazoProducao) {
  const prazo = prazoTrabalho(trabalho, tipoPrazo);
  if (prazo) return formatDiaMesBr(prazo);
  if (trabalho.dataPrevista) return formatDiaMesBr(new Date(trabalho.dataPrevista));
  return "—";
}

export function agruparTrabalhosPainelServicos(
  trabalhos: TrabalhoPainelServicos[],
  tipoPrazo: TipoPrazoProducao = "lab"
): GrupoOsPainelServicos[] {
  const mapa = new Map<string, TrabalhoPainelServicos[]>();

  for (const trabalho of trabalhos) {
    const chave = chaveGrupoOs(trabalho);
    const lista = mapa.get(chave) || [];
    lista.push(trabalho);
    mapa.set(chave, lista);
  }

  const grupos: GrupoOsPainelServicos[] = [];

  for (const [chave, lista] of mapa) {
    const principal =
      lista.find((t) => t.segmentoFaturamento === "servico") || lista[0];
    const servicos = [
      ...new Set(lista.map((t) => t.tipoProtese.trim()).filter(Boolean)),
    ];
    const textos = lista.map((t) => t.instrucoes || "");
    const { colaboradores, etapas } = parseComplementosInstrucoesGrupo(textos);
    const cols = colaboradoresParaExibicaoControle(colaboradores, etapas);
    const prazoLab = prazoTrabalho(principal, "lab");
    const prazoDent = prazoTrabalho(principal, "dentista");

    grupos.push({
      chave,
      idPrincipal: principal.id,
      numeroOs: principal.numeroOs,
      clienteNome: principal.cliente?.nome?.trim() || "—",
      pacienteNome: principal.paciente?.nome?.trim() || "—",
      servicos,
      status: principal.status,
      situacao: STATUS_TRABALHO[principal.status]?.label || principal.status,
      colaborador: resumoColaboradorControle(cols) || "—",
      prazoLab: prazoLab ? formatDataCompleta(prazoLab) : "—",
      prazoDent: prazoDent ? formatDataCompleta(prazoDent) : "—",
      caixa: caixaDeInstrucoes(textos.join("\n")),
      dataExibicao: dataExibicaoGrupo(principal, tipoPrazo),
      trabalhos: lista,
    });
  }

  return grupos;
}

export function rotuloFimPeriodoVencendo(periodo: string, locale: Locale = "pt") {
  const tag = localeDataIntl(locale);
  if (periodo === "hoje") {
    return new Date().toLocaleDateString(tag, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }
  const [year, month, day] = periodo.split("-").map(Number);
  if (!year || !month || !day) return periodo;
  return new Date(year, month - 1, day).toLocaleDateString(tag, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
