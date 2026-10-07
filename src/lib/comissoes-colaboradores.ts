import { mesCompetenciaDeDataBr } from "@/lib/comissao-colaboradores-pagamento";
import {
  calcularComissaoTrabalho,
  usaComissaoColaborador,
} from "@/lib/colaborador-remuneracao";
import {
  carregarColaboradoresListagem,
  type ColaboradorListagem,
} from "@/lib/colaboradores-listagem";
import {
  colaboradoresParaExibicaoControle,
  nomeEtapaSemSetor,
  normalizarNomeEtapaCadastro,
  parseComplementosInstrucoesGrupo,
  tipoComissaoDeTexto,
  valorNumericoComissaoTexto,
  type ColaboradorOsLinha,
  type EtapaOsLinha,
  type TipoComissaoOs,
} from "@/lib/etapas-os";
import { parseCurrencyBr } from "@/lib/cliente-financeiro";
import { itensDaOsModulo, type ItemModuloOs, type TrabalhoModuloOs } from "@/lib/modulo-producao-os";
import { lerMapaEtapasConcluidasModulo } from "@/lib/modulo-producao-etapas";
import { normalizarChaveStatusOs } from "@/lib/status-os";
import { baixarCsv } from "@/lib/exportar-csv";
import { classificarItemOs } from "@/lib/trabalho-os-segmento";
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
  comissaoTipo: TipoComissaoOs;
  valorServico: number;
  comissaoValor: number;
  mesCompetencia: string;
  etapaFinalizada: boolean;
  elegivel: boolean;
};

function chaveGrupoOs(t: { numeroOs: number; grupoOsId?: string | null }) {
  return t.grupoOsId?.trim() || String(t.numeroOs);
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

export function calcularValorComissaoColaborador(
  valorServico: number,
  comissaoOs: string,
  cadastro?: ColaboradorListagem
): { valor: number; percentual: number; tipo: TipoComissaoOs } {
  const textoOs = (comissaoOs || "").trim();
  const valorOs = textoOs ? valorNumericoComissaoTexto(textoOs) : "";
  if (textoOs && valorOs && valorOs !== "0,00") {
    const tipo = tipoComissaoDeTexto(textoOs);
    const valor = calcularComissaoTrabalho(valorServico, valorOs, tipo);
    return {
      valor,
      percentual: tipo === "%" ? Number(valorOs.replace(/\./g, "").replace(",", ".")) || 0 : 0,
      tipo,
    };
  }

  if (cadastro && usaComissaoColaborador(cadastro.tipoContratacao)) {
    const tipo: TipoComissaoOs = cadastro.tipoValorComissao === "R$" ? "R$" : "%";
    const valorTexto = cadastro.comissaoPercentual || "0,00";
    const valor = calcularComissaoTrabalho(valorServico, valorTexto, tipo);
    return {
      valor,
      percentual: tipo === "%" ? Number(valorTexto.replace(/\./g, "").replace(",", ".")) || 0 : 0,
      tipo,
    };
  }

  return { valor: 0, percentual: 0, tipo: "%" };
}

function cadastroDoColaborador(
  colaborador: ColaboradorOsLinha,
  cadastro: ColaboradorListagem[]
) {
  return cadastro.find(
    (c) => c.nome.trim().toLowerCase() === colaborador.nome.trim().toLowerCase()
  );
}

function mesCompetenciaDeEntrada(dataEntrada?: string | null) {
  const iso = (dataEntrada || "").match(/^(\d{4})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  return mesCompetenciaDeDataBr(formatDate(dataEntrada || ""));
}

function descricaoItem(trabalho: TrabalhoComissao, servico: string) {
  const partes = [trabalho.dentes?.trim(), trabalho.cor?.trim(), trabalho.material?.trim()].filter(
    Boolean
  );
  if (partes.length) return partes.join(" · ");
  return servico;
}

const SITUACOES_SERVICO_FINALIZADO = new Set(["finalizado", "entregue"]);

function servicoFinalizado(situacaoKey: string) {
  return SITUACOES_SERVICO_FINALIZADO.has(situacaoKey);
}

function itemElegivelComissao(item: ItemModuloOs) {
  if (item.tipo === "produto" || item.tipo === "frete") return false;
  return classificarItemOs({ servico: item.descricao }) === "servico";
}

function segmentoElegivelComissao(segmento?: string | null) {
  const valor = (segmento || "servico").trim().toLowerCase();
  return valor === "servico";
}

function indicesConcluidosDoItem(
  chaveItem: string,
  trabalhoId: string,
  mapaConcluidas: Record<string, number[]>
) {
  const direto = mapaConcluidas[chaveItem];
  if (Array.isArray(direto)) return direto;

  const prefixo = `${trabalhoId}:`;
  for (const [chave, indices] of Object.entries(mapaConcluidas)) {
    if (!Array.isArray(indices)) continue;
    if (chave === trabalhoId || chave.startsWith(prefixo)) return indices;
  }
  return [];
}

function etapaColaboradorFinalizada(
  chaveItem: string,
  trabalhoId: string,
  nomeEtapaColaborador: string,
  etapas: EtapaOsLinha[],
  mapaConcluidas: Record<string, number[]>
) {
  const nome = nomeEtapaColaborador.trim();
  if (!nome) return false;

  const alvo = nomeEtapaSemSetor(nome).toLowerCase();
  const indiceEtapa = etapas.findIndex((item) => {
    const cadastro = normalizarNomeEtapaCadastro(item.nome).toLowerCase();
    const semSetor = nomeEtapaSemSetor(item.nome).toLowerCase();
    return cadastro === alvo || semSetor === alvo || item.nome.trim().toLowerCase() === alvo;
  });
  if (indiceEtapa < 0) return false;

  const concluidas = indicesConcluidosDoItem(chaveItem, trabalhoId, mapaConcluidas);
  return concluidas.includes(indiceEtapa);
}

function elegivelComissaoColaborador(
  situacaoKey: string,
  chaveItem: string,
  trabalhoId: string,
  colaborador: ColaboradorOsLinha,
  etapas: EtapaOsLinha[],
  mapaConcluidas: Record<string, number[]>
) {
  if (servicoFinalizado(situacaoKey)) return true;
  if (!colaborador.etapa.trim()) return false;
  return etapaColaboradorFinalizada(
    chaveItem,
    trabalhoId,
    colaborador.etapa,
    etapas,
    mapaConcluidas
  );
}

function situacaoEtapaLabel(
  chaveItem: string,
  trabalhoId: string,
  nomeEtapa: string,
  etapas: EtapaOsLinha[],
  mapaConcluidas: Record<string, number[]>
) {
  const nome = nomeEtapa.trim();
  if (!nome) return "—";
  return etapaColaboradorFinalizada(chaveItem, trabalhoId, nome, etapas, mapaConcluidas)
    ? "Finalizada"
    : "Pendente";
}

export function montarLinhasComissaoColaboradores(
  trabalhos: TrabalhoComissao[],
  opts?: {
    cadastro?: ColaboradorListagem[];
    mapaEtapasConcluidas?: Record<string, number[]>;
    incluirPendentes?: boolean;
  }
): LinhaComissaoColaborador[] {
  const cadastro = opts?.cadastro ?? carregarColaboradoresListagem();
  const grupos = new Map<string, TrabalhoComissao[]>();

  for (const t of trabalhos) {
    const chave = chaveGrupoOs(t);
    const lista = grupos.get(chave) || [];
    lista.push(t);
    grupos.set(chave, lista);
  }

  const linhas: LinhaComissaoColaborador[] = [];
  const mapaEtapasConcluidas = opts?.mapaEtapasConcluidas ?? lerMapaEtapasConcluidasModulo();
  const incluirPendentes = Boolean(opts?.incluirPendentes);

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
      if (!segmentoElegivelComissao(trabalho.segmentoFaturamento)) continue;

      const itens = itensDaOsModulo(trabalho).filter(itemElegivelComissao);
      const listaItens =
        itens.length > 0
          ? itens
          : classificarItemOs({ servico: trabalho.tipoProtese }) === "servico"
            ? [
                {
                  id: `${trabalho.id}-principal`,
                  descricao: trabalho.tipoProtese,
                  qtd: "1",
                  situacao: trabalho.status,
                  tipo: "trabalho" as const,
                },
              ]
            : [];

      for (const item of listaItens) {
        const valorServico =
          valorItemLinha(trabalho.instrucoes || "", item.descricao) || trabalho.valor || 0;
        const situacaoKey = normalizarChaveStatusOs(trabalho.status);
        const chaveItem = `${trabalho.id}:${item.id}`;

        for (const colaborador of colaboradores) {
          const etapaFinalizada = etapaColaboradorFinalizada(
            chaveItem,
            trabalho.id,
            colaborador.etapa,
            complementos.etapas,
            mapaEtapasConcluidas
          );
          const geraComissao = elegivelComissaoColaborador(
            situacaoKey,
            chaveItem,
            trabalho.id,
            colaborador,
            complementos.etapas,
            mapaEtapasConcluidas
          );
          if (!geraComissao && !incluirPendentes) continue;

          const calculada = calcularValorComissaoColaborador(
            valorServico,
            colaborador.comissao,
            cadastroDoColaborador(colaborador, cadastro)
          );
          const comissaoValor =
            geraComissao || incluirPendentes ? calculada.valor : 0;

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
            situacaoEtapa: situacaoEtapaLabel(
              chaveItem,
              trabalho.id,
              colaborador.etapa,
              complementos.etapas,
              mapaEtapasConcluidas
            ),
            situacao: STATUS_TRABALHO[situacaoKey]?.label || situacaoKey,
            situacaoKey,
            comissaoPercentual: calculada.percentual,
            comissaoTipo: calculada.tipo,
            valorServico,
            comissaoValor,
            mesCompetencia: mesCompetenciaDeEntrada(trabalho.dataEntrada),
            etapaFinalizada,
            elegivel: geraComissao,
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

export function exportarComissaoColaboradoresCsv(linhas: LinhaComissaoColaborador[]) {
  baixarCsv(
    "comissao-colaboradores.csv",
    [
      "OS",
      "Data",
      "Entregue",
      "Qtd",
      "Serviço",
      "Descrição",
      "Cliente",
      "Paciente",
      "Colaborador",
      "Etapa",
      "Situação Etapa",
      "Situação",
      "Comissão",
    ],
    linhas.map((l) => [
      l.numeroOs,
      l.dataLancamento,
      l.dataEntrega,
      l.qtd,
      l.servico,
      l.descricao,
      l.cliente,
      l.paciente,
      l.colaborador,
      l.etapa,
      l.situacaoEtapa,
      l.situacao,
      formatarMoedaComissao(l.comissaoValor),
    ])
  );
}
