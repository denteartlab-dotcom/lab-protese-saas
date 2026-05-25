import { carregarColaboradoresListagem } from "@/lib/colaboradores-listagem";
import {
  colaboradoresParaExibicaoControle,
  parseComplementosInstrucoesGrupo,
  type ColaboradorOsLinha,
} from "@/lib/etapas-os";
import { parseCurrencyBr } from "@/lib/cliente-financeiro";
import { itensDaOsModulo, type TrabalhoModuloOs } from "@/lib/modulo-producao-os";
import { STATUS_TRABALHO, formatCurrency, formatDate } from "@/lib/utils";

export type TrabalhoComissao = TrabalhoModuloOs & {
  numeroOs: number;
  grupoOsId?: string | null;
  dataEntrega?: string | null;
  segmentoFaturamento?: string | null;
};

export type LinhaComissaoColaborador = {
  id: string;
  trabalhoId: string;
  numeroOs: number;
  dataLancamento: string;
  dataEntrega: string;
  qtd: string;
  servico: string;
  descricao: string;
  cliente: string;
  paciente: string;
  colaborador: string;
  etapa: string;
  situacaoEtapa: string;
  situacao: string;
  situacaoKey: string;
  comissaoPercentual: number;
  valorServico: number;
  comissaoValor: number;
};

function chaveGrupoOs(t: { numeroOs: number; grupoOsId?: string | null }) {
  return t.grupoOsId?.trim() || String(t.numeroOs);
}

function parsePercentual(value: string) {
  const limpo = (value || "0").replace(/%/g, "").trim().replace(/\./g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

function valorItemLinha(instrucoes: string, descricaoItem: string) {
  const alvo = descricaoItem.trim().toLowerCase();
  for (const line of (instrucoes || "").split("\n")) {
    if (!line.trim().startsWith("Item adicionado:")) continue;
    const matchServico = line.match(/^Item adicionado:\s*(.*?)\s*-\s*dentes/i);
    const servico = matchServico?.[1]?.trim().toLowerCase() || "";
    if (servico && alvo && !servico.includes(alvo) && !alvo.includes(servico.replace(/^produto:\s*/i, ""))) {
      continue;
    }
    const matchValor = line.match(/ - valor (.*?)(?: - |$)/i);
    if (matchValor) return parseCurrencyBr(matchValor[1]);
  }
  return 0;
}

function percentualColaborador(
  colaborador: ColaboradorOsLinha,
  cadastro = carregarColaboradoresListagem()
) {
  const daOs = parsePercentual(colaborador.comissao);
  if (daOs > 0) return daOs;
  const item = cadastro.find(
    (c) => c.nome.trim().toLowerCase() === colaborador.nome.trim().toLowerCase()
  );
  return item ? parsePercentual(item.comissaoPercentual) : 0;
}

function descricaoItem(trabalho: TrabalhoComissao, servico: string) {
  const partes = [trabalho.dentes?.trim(), trabalho.cor?.trim(), trabalho.material?.trim()].filter(
    Boolean
  );
  if (partes.length) return partes.join(" · ");
  return servico;
}

function situacaoEtapaLabel(etapa: string) {
  return etapa.trim() || "—";
}

export function montarLinhasComissaoColaboradores(
  trabalhos: TrabalhoComissao[]
): LinhaComissaoColaborador[] {
  const cadastro = carregarColaboradoresListagem();
  const grupos = new Map<string, TrabalhoComissao[]>();

  for (const t of trabalhos) {
    const chave = chaveGrupoOs(t);
    const lista = grupos.get(chave) || [];
    lista.push(t);
    grupos.set(chave, lista);
  }

  const linhas: LinhaComissaoColaborador[] = [];

  for (const grupo of grupos.values()) {
    const textos = grupo.map((t) => t.instrucoes || "");
    const complementos = parseComplementosInstrucoesGrupo(textos);
    const colaboradores = colaboradoresParaExibicaoControle(
      complementos.colaboradores,
      complementos.etapas
    );
    if (colaboradores.length === 0) continue;

    const referencia = grupo[0];
    const numeroOs = referencia.numeroOs;

    for (const trabalho of grupo) {
      const itens = itensDaOsModulo(trabalho).filter((i) => i.tipo === "trabalho");
      const listaItens =
        itens.length > 0
          ? itens
          : [
              {
                id: `${trabalho.id}-principal`,
                descricao: trabalho.tipoProtese,
                qtd: "1",
                situacao: trabalho.status,
                tipo: "trabalho" as const,
              },
            ];

      for (const item of listaItens) {
        const valorServico =
          valorItemLinha(trabalho.instrucoes || "", item.descricao) || trabalho.valor || 0;

        for (const colaborador of colaboradores) {
          const pct = percentualColaborador(colaborador, cadastro);
          const comissaoValor = (valorServico * pct) / 100;
          const situacaoKey = item.situacao || trabalho.status;

          linhas.push({
            id: `${trabalho.id}-${item.id}-${colaborador.nome}`,
            trabalhoId: trabalho.id,
            numeroOs,
            dataLancamento: formatDate(trabalho.dataEntrada || ""),
            dataEntrega: trabalho.dataEntrega ? formatDate(trabalho.dataEntrega) : "—",
            qtd: item.qtd || "1",
            servico: item.descricao,
            descricao: descricaoItem(trabalho, item.descricao),
            cliente: trabalho.cliente?.nome?.trim() || "—",
            paciente: trabalho.paciente?.nome?.trim() || "—",
            colaborador: colaborador.nome,
            etapa: colaborador.etapa,
            situacaoEtapa: situacaoEtapaLabel(colaborador.etapa),
            situacao: STATUS_TRABALHO[situacaoKey]?.label || situacaoKey,
            situacaoKey,
            comissaoPercentual: pct,
            valorServico,
            comissaoValor,
          });
        }
      }
    }
  }

  return linhas.sort((a, b) => {
    if (a.numeroOs !== b.numeroOs) return b.numeroOs - a.numeroOs;
    return a.colaborador.localeCompare(b.colaborador, "pt-BR");
  });
}

export function formatarMoedaComissao(valor: number) {
  return formatCurrency(valor);
}
