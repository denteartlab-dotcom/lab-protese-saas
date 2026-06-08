import { parseCurrencyBr } from "@/lib/cliente-financeiro";
import { itensDaOsModulo, type TrabalhoModuloOs } from "@/lib/modulo-producao-os";
import { carregarPrestadoresListagem } from "@/lib/prestadores-listagem";
import {
  parseComplementosInstrucoesGrupo,
  type TerceirizadoOsLinha,
} from "@/lib/etapas-os";
import { normalizarChaveStatusOs } from "@/lib/status-os";
import { formatCurrency, formatDate, STATUS_TRABALHO } from "@/lib/utils";

export type TrabalhoFinalizador = TrabalhoModuloOs & {
  numeroOs: number;
  grupoOsId?: string | null;
  dataPrevista?: string | null;
  dataEntrega?: string | null;
  segmentoFaturamento?: string | null;
};

export type LinhaFinalizadorServico = {
  id: string;
  trabalhoId: string;
  numeroOs: number;
  dataPedido: string;
  dataEntrega: string;
  prazo: string;
  qtd: string;
  servico: string;
  descricao: string;
  cliente: string;
  paciente: string;
  prestador: string;
  situacaoPedido: string;
  situacaoKey: string;
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

function custoTerceirizado(
  terceiro: TerceirizadoOsLinha,
  valorServico: number,
  cadastro = carregarPrestadoresListagem()
) {
  const custoTexto = (terceiro.custo || "").trim();
  if (custoTexto.includes("%")) {
    return (valorServico * parsePercentual(custoTexto)) / 100;
  }
  const valorCusto = parseCurrencyBr(custoTexto);
  if (valorCusto > 0) return valorCusto;

  const prestador = cadastro.find(
    (p) => p.nome.trim().toLowerCase() === terceiro.nome.trim().toLowerCase()
  );
  if (!prestador) return 0;
  const pct = parsePercentual(prestador.valorComissao);
  return (valorServico * pct) / 100;
}

function descricaoItem(trabalho: TrabalhoFinalizador, servico: string) {
  const partes = [trabalho.dentes?.trim(), trabalho.cor?.trim(), trabalho.material?.trim()].filter(
    Boolean
  );
  if (partes.length) return partes.join(" · ");
  return servico;
}

function prazoExibicao(trabalho: TrabalhoFinalizador) {
  if (trabalho.dataPrevista) return formatDate(trabalho.dataPrevista);
  const match = (trabalho.instrucoes || "").match(/Data laboratório:\s*(\d{2}\/\d{2}\/\d{2,4})/i);
  return match?.[1] || "—";
}

export function montarLinhasFinalizadoresServicos(
  trabalhos: TrabalhoFinalizador[]
): LinhaFinalizadorServico[] {
  const grupos = new Map<string, TrabalhoFinalizador[]>();

  for (const t of trabalhos) {
    const chave = chaveGrupoOs(t);
    const lista = grupos.get(chave) || [];
    lista.push(t);
    grupos.set(chave, lista);
  }

  const linhas: LinhaFinalizadorServico[] = [];

  for (const grupo of grupos.values()) {
    const textos = grupo.map((t) => t.instrucoes || "");
    const complementos = parseComplementosInstrucoesGrupo(textos);
    const terceirizados = complementos.terceirizados;
    if (terceirizados.length === 0) continue;

    const numeroOs = grupo[0].numeroOs;

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

        for (const terceiro of terceirizados) {
          const situacaoKey = normalizarChaveStatusOs(trabalho.status);
          const servicoLinha = terceiro.servico.trim() || item.descricao;

          linhas.push({
            id: `${trabalho.id}-${item.id}-${terceiro.nome}`,
            trabalhoId: trabalho.id,
            numeroOs,
            dataPedido: formatDate(trabalho.dataEntrada || ""),
            dataEntrega: trabalho.dataEntrega ? formatDate(trabalho.dataEntrega) : "—",
            prazo: prazoExibicao(trabalho),
            qtd: item.qtd || "1",
            servico: servicoLinha,
            descricao: descricaoItem(trabalho, item.descricao),
            cliente: trabalho.cliente?.nome?.trim() || "—",
            paciente: trabalho.paciente?.nome?.trim() || "—",
            prestador: terceiro.nome,
            situacaoPedido: STATUS_TRABALHO[situacaoKey]?.label || situacaoKey,
            situacaoKey,
            valorServico,
            comissaoValor: custoTerceirizado(terceiro, valorServico),
          });
        }
      }
    }
  }

  return linhas.sort((a, b) => {
    if (a.numeroOs !== b.numeroOs) return b.numeroOs - a.numeroOs;
    return a.prestador.localeCompare(b.prestador, "pt-BR");
  });
}

export function formatarMoedaFinalizador(valor: number) {
  return formatCurrency(valor);
}
