"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Camera,
  Edit3,
  Eye,
  ImageUp,
  Plus,
  Printer,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import {
  ControleProducaoFiltrosLista,
  ControleProducaoToolbar,
} from "@/components/ControleProducaoToolbar";
import { EtapasControleCelula } from "@/components/producao/EtapasControleCelula";
import {
  EtapasOsEditor,
  etapasFormParaLinhasInstrucoes,
  etapasOsLinhaParaForm,
  type EtapaOsFormLinha,
} from "@/components/producao/EtapasOsEditor";
import { ConfirmacaoExclusaoModal } from "@/components/ConfirmacaoExclusaoModal";
import { ImprimirOsModal } from "@/components/ImprimirOsModal";
import {
  buscarRegistroParaBlocoSalvar,
  classificarItemOs,
  editIdPreferidoGrupo,
  grupoOsIdOf,
  deveDividirOs,
  formatarDescontoItemOs,
  grupoOsTemMultiplosSegmentos,
  itemExibeBadgeProduto,
  itemExibeBadgeTransporte,
  itemUsaCamposOdontologicos,
  nomeExibicaoItemOs,
  planejarBlocosSalvarOs,
  segmentoEfetivoTrabalho,
  situacaoExibicaoTrabalho,
  tituloSegmentoOs,
  tituloTrabalhoServicoItem,
  deveExibirTrabalhoNoControleProducao,
  expandirControleProducaoComServicoDoGrupo,
  trabalhosDoMesmoGrupoOsId,
  type RegistroGrupoOs,
  type SegmentoFaturamento,
} from "@/lib/trabalho-os-segmento";
import { bodyTrabalhoSemNull } from "@/lib/trabalho-api-body";
import { ConfiguracaoListaGear } from "@/components/listagem/ConfiguracaoListaGear";
import { Button, CampoDataBr, Input, Select, SelectPesquisavel, Textarea } from "@/components/ui";
import { parseCurrencyBr } from "@/lib/cliente-financeiro";
import { brShortToIso, parseBrDate } from "@/lib/datas-br";
import { propsInputComSelecaoAoFocar } from "@/lib/input-selecao";
import { calcularDatasPrazoServico } from "@/lib/prazos-servico";
import {
  buscarServicoNaTabela,
  carregarCategoriasPorTabelaPreco,
  categoriaDoServicoNaTabela,
  comissoesColaboradoresDoServico,
  comissoesTerceirizadosDoServico,
  etapasFormParaItemServico,
  categoriasSelecionaveisNaOs,
  servicosDaCategoriaTabela,
  servicosSelecionaveisNaOs,
  servicoTemComissoesColaboradoresNaTabela,
  servicoTemComissoesTerceirizadosNaTabela,
  type CategoriaTabelaPrecoOs,
} from "@/lib/tabela-precos-os";
import {
  carregarColaboradoresListagem,
  type ColaboradorListagem,
} from "@/lib/colaboradores-listagem";
import {
  carregarEtapasCadastro,
  colaboradoresParaExibicaoControle,
  deduplicarColaboradores,
  deduplicarTerceirizados,
  exibirComissaoPercentual,
  formatarComissaoPercentInput,
  formatarLinhaColaborador,
  formatarLinhaEtapa,
  nomeEtapaSemSetor,
  parseComplementosInstrucoesGrupo,
  parseEtapasInstrucoes,
  removerComplementosOsDoCorpo,
  resumoColaboradorControle,
  type ColaboradorOsLinha,
  type TerceirizadoOsLinha,
} from "@/lib/etapas-os";
import {
  filtrarTrabalhosAtrasados,
  filtrarTrabalhosVencendoPeriodo,
  type TipoPrazoProducao,
} from "@/lib/controle-producao-prazos";
import { BarraConfigListagem } from "@/components/listagem/BarraConfigListagem";
import { useListagemPaginada } from "@/hooks/use-listagem-paginada";
import {
  compararDataIso,
  compararNumero,
  compararTextoBr,
} from "@/lib/listagem-config";
import { readStorage, writeStorage } from "@/lib/persisted-storage";
import {
  grupoOsEstaFaturado,
  MENSAGEM_OS_FATURADA_NAO_EXCLUI,
  type LancamentoFaturaOs,
} from "@/lib/os-faturamento";
import { notificarTrabalhosAtualizados } from "@/lib/trabalhos-events";
import {
  DENTES_DECIDUOS_INFERIORES,
  DENTES_DECIDUOS_SUPERIORES,
  tipoDenticaoFromNumerosDentes,
  urlImagemDente,
} from "@/lib/dentes-imagens";
import { cn, exibirTexto, formatCurrency, formatDate, STATUS_TRABALHO } from "@/lib/utils";
import {
  etapasConcluidasModulo,
  indiceEtapaAtualDeConcluidas,
  persistirEtapaAtualOs,
} from "@/lib/modulo-producao-etapas";
import { contextoEtapasModuloOsGrupo, itensDaOsModulo } from "@/lib/modulo-producao-os";

type CampoOrdenacaoControle = "numeroOs" | "dataEntrada" | "cliente" | "paciente";

type Trabalho = {
  id: string;
  numeroOs: number;
  clienteId?: string;
  pacienteId?: string;
  segmentoFaturamento?: string | null;
  grupoOsId?: string | null;
  tipoProtese: string;
  dentes?: string | null;
  cor?: string | null;
  material?: string | null;
  escala?: string | null;
  status: string;
  valor: number;
  dataEntrada: string;
  dataPrevista?: string | null;
  dataEntrega?: string | null;
  observacoes?: string | null;
  instrucoes?: string | null;
  cliente?: { id?: string; nome?: string | null; cro?: string | null };
  paciente?: { id?: string; nome?: string | null };
};

type DadosPostGrupoOs = {
  clienteId: string;
  pacienteId: string;
  numeroOs: number;
  grupoOsId: string;
  dataEntrada: string;
};

function dadosPostGrupoOsDeTrabalho(trabalho: Trabalho): DadosPostGrupoOs | null {
  const clienteId = trabalho.clienteId || trabalho.cliente?.id;
  const pacienteId = trabalho.pacienteId || trabalho.paciente?.id;
  if (!clienteId || !pacienteId) return null;
  return {
    clienteId,
    pacienteId,
    numeroOs: trabalho.numeroOs,
    grupoOsId: trabalho.grupoOsId || trabalho.id,
    dataEntrada: trabalho.dataEntrada,
  };
}

const OPCOES_ORDENACAO_CONTROLE = [
  { valor: "numeroOs" as const, label: "Num OS" },
  { valor: "dataEntrada" as const, label: "Entrada" },
  { valor: "cliente" as const, label: "Cliente" },
  { valor: "paciente" as const, label: "Paciente" },
];

const FORNECEDORES_STORAGE_KEY = "labProteseFornecedores";
const PRESTADORES_STORAGE_KEY = "labProtesePrestadores";

type TerceirizadoOpcao = {
  id: string;
  nome: string;
  origem: "fornecedor" | "prestador";
  valorComissao?: string;
  valorComissaoRepeticao?: string;
  tipoServico?: string;
};

type TerceirizadoStorage = {
  id?: string;
  nome?: string;
  valorComissao?: string;
  valorComissaoRepeticao?: string;
  tipoServico?: string;
};

const COMPARADORES_CONTROLE: Record<
  CampoOrdenacaoControle,
  (a: Trabalho, b: Trabalho) => number
> = {
  numeroOs: (a, b) => compararNumero(a.numeroOs, b.numeroOs),
  dataEntrada: (a, b) => compararDataIso(a.dataEntrada, b.dataEntrada),
  cliente: (a, b) => compararTextoBr(clienteNome(a), clienteNome(b)),
  paciente: (a, b) => compararTextoBr(pacienteNome(a), pacienteNome(b)),
};

type EditForm = {
  categoria: string;
  tipoProtese: string;
  dentes: string;
  cor: string;
  escalaCor: string;
  material: string;
  status: string;
  valor: string;
  quantidade: string;
  descontoTipo: string;
  desconto: string;
  dataPrevista: string;
  dataLaboratorio: string;
  horaLaboratorio: string;
  dataDentista: string;
  horaDentista: string;
  observacoes: string;
  /** Texto digitado só para o serviço em edição (vai em ` - obs ` na linha do item). */
  observacaoServico: string;
  /** Corpo das instruções da OS sem linhas de itens (preservado ao gravar). */
  instrucoesCorpo: string;
  urgente: boolean;
  repeticao: boolean;
};

type AbaServicoEdicao = "etapas" | "produtos" | "colaboradores" | "terceiros";
type PainelEdicaoItem = "servico" | "produto" | "transporte";

type ProdutoCadastro = { id: string; nome: string; valor: number };
type ProdutoOsEdicao = {
  produtoId: string;
  quantidade: string;
  valorUnitario: string;
  valor: string;
  observacao: string;
};

function valorUnitarioProdutoOs(produtoOs: ProdutoOsEdicao) {
  return parseCurrencyBr(produtoOs.valorUnitario || produtoOs.valor || "R$ 0,00");
}

function valorTotalLinhaProdutoOs(produtoOs: ProdutoOsEdicao) {
  const qtd = Number(produtoOs.quantidade || 1) || 1;
  return valorUnitarioProdutoOs(produtoOs) * qtd;
}

function produtoOsVazio(): ProdutoOsEdicao {
  return {
    produtoId: "",
    quantidade: "1",
    valorUnitario: "R$ 0,00",
    valor: "R$ 0,00",
    observacao: "",
  };
}

function atualizarProdutoOsQuantidade(item: ProdutoOsEdicao, quantidade: string): ProdutoOsEdicao {
  const qtd = Number(quantidade) || 1;
  return {
    ...item,
    quantidade,
    valor: formatCurrency(valorUnitarioProdutoOs(item) * qtd),
  };
}

function atualizarProdutoOsSelecao(
  item: ProdutoOsEdicao,
  produto: ProdutoCadastro | undefined,
  produtoId: string
): ProdutoOsEdicao {
  const qtd = Number(item.quantidade || 1) || 1;
  const unit = produto?.valor ?? valorUnitarioProdutoOs(item);
  const valorUnitario = formatCurrency(unit);
  return {
    ...item,
    produtoId,
    valorUnitario,
    valor: formatCurrency(unit * qtd),
    observacao: produto?.nome || item.observacao,
  };
}

function atualizarProdutoOsValorTotal(item: ProdutoOsEdicao, totalStr: string): ProdutoOsEdicao {
  const qtd = Number(item.quantidade || 1) || 1;
  const total = parseCurrencyBr(formatCurrencyInputControle(totalStr));
  return {
    ...item,
    valor: formatCurrency(total),
    valorUnitario: formatCurrency(total / qtd),
  };
}

function escalaOsParaSalvarControle(itens: EditItem[]) {
  const itemServico = itens.find((item) => classificarItemOs(item) === "servico");
  return itemServico?.categoria?.trim() || "";
}

function valorItensControle(itens: EditItem[]) {
  return itens.reduce(
    (sum, item) => sum + valorComDescontoControle(item.valor, item.descontoTipo, item.desconto),
    0
  );
}

function montarLinhasComplementosOs(
  colaboradores: ColaboradorOsLinha[],
  terceirizados: TerceirizadoOsLinha[]
) {
  const linhasColaboradores = deduplicarColaboradores(colaboradores)
    .filter((colaborador) => colaborador.nome.trim())
    .map((colaborador) => formatarLinhaColaborador(colaborador))
    .filter(Boolean);
  const linhasTerceirizados = deduplicarTerceirizados(terceirizados)
    .filter((terceiro) => terceiro.nome.trim() || terceiro.servico.trim() || terceiro.custo.trim())
    .map(
      (terceiro) =>
        `Terceirizado ${terceiro.nome || "-"}: ${terceiro.servico || "serviço"}${
          terceiro.custo ? ` - custo ${terceiro.custo}` : ""
        }`
    );
  return [...linhasColaboradores, ...linhasTerceirizados].join("\n");
}

function montarInstrucoesSegmentoControle(
  itens: EditItem[],
  corpoSemEtapas: string,
  linhasEtapas: string,
  segmento: SegmentoFaturamento,
  linhasComplementos?: string
) {
  let corpo: string;
  if (segmento === "servico") {
    const base =
      linhasEtapas || linhasComplementos
        ? removerComplementosOsDoCorpo(corpoSemEtapas)
        : corpoSemEtapas;
    corpo = [base, linhasEtapas, linhasComplementos].filter(Boolean).join("\n");
  } else {
    corpo = removerComplementosOsDoCorpo(corpoSemEtapas);
  }
  const linhas = itens.map(formatarLinhaItemEdicao).join("\n");
  return [corpo, linhas].filter(Boolean).join("\n");
}

function parsePercentualControle(value = "") {
  return Number(value.replace("%", "").replace(/\./g, "").replace(",", ".")) || 0;
}

function carregarOpcoesTerceirizadosControle(): TerceirizadoOpcao[] {
  try {
    const fornecedores = readStorage<TerceirizadoStorage[]>(FORNECEDORES_STORAGE_KEY, []);
    const prestadores = readStorage<TerceirizadoStorage[]>(PRESTADORES_STORAGE_KEY, []);
    const fornecedoresAtivos: TerceirizadoOpcao[] = Array.isArray(fornecedores)
      ? fornecedores
          .filter((item) => item?.nome?.trim())
          .map((item) => ({
            id: item.id || item.nome || "",
            nome: item.nome!.trim(),
            origem: "fornecedor" as const,
            valorComissao: item.valorComissao,
            valorComissaoRepeticao: item.valorComissaoRepeticao,
            tipoServico: item.tipoServico,
          }))
      : [];
    const prestadoresAtivos: TerceirizadoOpcao[] = Array.isArray(prestadores)
      ? prestadores
          .filter((item) => item?.nome?.trim())
          .map((item) => ({
            id: item.id || item.nome || "",
            nome: item.nome!.trim(),
            origem: "prestador" as const,
            valorComissao: item.valorComissao,
            valorComissaoRepeticao: item.valorComissaoRepeticao,
            tipoServico: item.tipoServico,
          }))
      : [];
    return [...prestadoresAtivos, ...fornecedoresAtivos];
  } catch {
    return [];
  }
}

type EditItem = {
  id: string;
  servico: string;
  categoria?: string;
  numeroDente: string;
  corDente: string;
  quantidade: string;
  valor: number;
  descontoTipo?: string;
  desconto?: string;
  situacao?: string;
  urgente?: boolean;
  repeticao?: boolean;
  produtoId?: string;
  observacao?: string;
};

function formatCurrencyInputControle(value: string) {
  const centavos = Number(String(value).replace(/\D/g, "")) || 0;
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatPercentInputControle(value: string) {
  const amount = Number(value.replace(/\D/g, "")) / 100;
  return amount.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function valorComDescontoControle(valor: number, descontoTipo?: string, desconto?: string) {
  const descontoTexto = desconto || "0,00";
  const descontoValor =
    descontoTipo === "valor" || descontoTexto.trim().startsWith("R$")
      ? parseCurrencyBr(descontoTexto)
      : valor *
        (Math.min(Math.max(Number(descontoTexto.replace(",", ".") || 0), 0), 100) / 100);

  return Math.max(valor - descontoValor, 0);
}

function formatarLinhaItemEdicao(item: EditItem) {
  const incluirCategoria = item.categoria?.trim() && itemUsaCamposOdontologicos(item);
  return `Item adicionado: ${item.servico} - dentes ${item.numeroDente} - cor ${item.corDente} - qtd ${item.quantidade} - valor ${item.valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })}${incluirCategoria ? ` - categoria ${item.categoria}` : ""}${
    itemUsaCamposOdontologicos(item) && item.desconto ? ` - desc ${item.desconto}` : ""
  }${itemUsaCamposOdontologicos(item) && item.situacao ? ` - situação ${item.situacao}` : ""}${
    item.produtoId ? ` - produtoId ${item.produtoId}` : ""
  }${item.urgente ? " - urgente" : ""}${item.repeticao ? " - repetição" : ""}${
    item.observacao ? ` - obs ${item.observacao}` : ""
  }`;
}

function tipoPainelEdicaoItem(item: EditItem): PainelEdicaoItem {
  const tipo = classificarItemOs(item);
  if (tipo === "produto") return "produto";
  if (tipo === "transporte") return "transporte";
  return "servico";
}

function TextareaObservacaoInterna({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <textarea
        ref={ref}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-none overflow-hidden rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        style={{ minHeight: "2.5rem" }}
      />
    </div>
  );
}

type StatusForm = {
  status: string;
  dataPrevista: string;
  observacoes: string;
  instrucoes: string;
};

type AnexoOs = {
  name: string;
  type: string;
  url: string;
};

function dateToInput(date: string | null | undefined) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

function statusLabel(status: string) {
  return STATUS_TRABALHO[status]?.label || status;
}

function clienteNome(trabalho: Trabalho) {
  return trabalho.cliente?.nome || "";
}

function pacienteNome(trabalho: Trabalho) {
  return trabalho.paciente?.nome || "";
}

function caixaOs(trabalho: Trabalho) {
  const line = (trabalho.instrucoes || "")
    .split("\n")
    .find((item) => item.trim().startsWith("Caixa:"));
  return line?.replace(/^Caixa:\s*/i, "").trim() || "";
}

function osBadge(numeroOs: number) {
  return (
    <span className="inline-flex min-w-9 items-center justify-center rounded bg-red-100 px-2 py-1 text-[13px] font-bold text-red-700">
      {numeroOs}
    </span>
  );
}

function CelulaSituacaoControle({
  trabalho,
  primeiroItem,
  onEditarStatus,
}: {
  trabalho: Trabalho;
  primeiroItem?: ReturnType<typeof parseItens>[number];
  onEditarStatus: () => void;
}) {
  const exibicao = situacaoExibicaoTrabalho(trabalho, primeiroItem);

  if (exibicao.kind === "produto") {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-600 px-2.5 py-1 text-[10px] font-semibold text-white">
        Produto
      </span>
    );
  }

  if (exibicao.kind === "transporte") {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
        Transporte
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onEditarStatus}
      className={`rounded px-2 py-1 text-[10px] font-semibold ${STATUS_TRABALHO[trabalho.status]?.color || "bg-slate-100 text-slate-700"}`}
      title="Alterar situação"
    >
      {statusLabel(trabalho.status)}
    </button>
  );
}

function parseMoney(value: string) {
  const normalized = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return Number(normalized) || 0;
}

function parseItens(trabalho: Trabalho): EditItem[] {
  const lines = (trabalho.instrucoes || "").split("\n");
  const itens = lines
    .map((line, index) => {
      const match = line.match(
        /^Item adicionado:\s*(.*?)\s*-\s*dentes\s*(.*?)\s*-\s*cor\s*(.*?)\s*-\s*qtd\s*(.*?)\s*-\s*valor\s*(.*)$/i
      );
      if (!match) return null;
      return {
        id: `${trabalho.id}-item-${index}`,
        servico: match[1]?.trim() || trabalho.tipoProtese,
        categoria:
          line.match(/ - categoria (.*?)(?: - desc| - situação| - produtoId| - urgente| - repetição| - repeticao| - obs|$)/i)?.[1]?.trim() ||
          trabalho.escala ||
          "",
        numeroDente: match[2]?.trim() || trabalho.dentes || "-",
        corDente: match[3]?.trim() || trabalho.cor || "-",
        quantidade: match[4]?.trim() || "1",
        valor: parseMoney(
          line.match(/ - valor (.*?)(?: - categoria| - desc| - situação| - produtoId| - urgente| - repetição| - repeticao| - obs|$)/i)?.[1] ||
            match[5] ||
            ""
        ),
        desconto:
          line.match(
            / - desc (.*?)(?: - categoria| - situação| - produtoId| - urgente| - repetição| - repeticao| - obs|$)/i
          )?.[1]?.trim() || "0,00",
        situacao:
          line.match(/ - situação (.*?)(?: - produtoId| - urgente| - repetição| - repeticao| - obs|$)/i)?.[1]?.trim() ||
          trabalho.status,
        observacao: line.match(/ - obs (.*)$/i)?.[1]?.trim() || "",
        urgente: / - urgente(?: -|$)/i.test(line),
        repeticao: / - repetição(?: -|$)| - repeticao(?: -|$)/i.test(line),
      };
    })
    .filter(Boolean) as EditItem[];

  if (itens.length > 0) return itens;

  return [
    {
      id: `${trabalho.id}-principal`,
      servico: trabalho.tipoProtese,
      numeroDente: trabalho.dentes || "-",
      corDente: trabalho.cor || "-",
      quantidade: "1",
      valor: trabalho.valor || 0,
      urgente: false,
      repeticao: false,
    },
  ];
}

function ServicoComMarcadores({ item }: { item: EditItem }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>{nomeExibicaoItemOs(item)}</span>
      {item.urgente && (
        <span className="text-[10px] font-extrabold uppercase tracking-wide text-red-800">
          URGENTE
        </span>
      )}
      {item.repeticao && (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-orange-100 px-1.5 text-[10px] font-extrabold text-orange-700">
          R
        </span>
      )}
    </div>
  );
}

function anexosFromInstrucoes(instrucoes?: string | null): AnexoOs[] {
  return (instrucoes || "")
    .split("\n")
    .map((line) => {
      if (!line.startsWith("Arquivo anexado:")) return null;
      const [name, type, url] = line.replace("Arquivo anexado:", "").split("|").map((item) => item.trim());
      if (!url) return null;
      return { name: name || "Arquivo", type: type || "", url };
    })
    .filter(Boolean) as AnexoOs[];
}

function instrucoesSemAnexos(instrucoes?: string | null) {
  return (instrucoes || "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("Arquivo anexado:") && !line.trim().startsWith("Arquivos anexados:"))
    .join("\n");
}

function instrucoesCorpoSemItens(instrucoes?: string | null) {
  return instrucoesSemAnexos(instrucoes)
    .split("\n")
    .filter((line) => !line.trim().startsWith("Item adicionado:"))
    .join("\n")
    .trim();
}

function instrucoesCorpoSemEtapas(corpo: string) {
  return corpo
    .split("\n")
    .filter((line) => !/^Etapa\s+/i.test(line.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function complementosEdicaoTrabalho(trabalho: Trabalho, todos: Trabalho[]) {
  const grupo = trabalhosDoMesmoGrupoOsId(trabalho, todos);
  const textos =
    grupo.length > 1
      ? grupo.map((item) => item.instrucoes || "")
      : [instrucoesConsolidadas(trabalho, todos)];
  return parseComplementosInstrucoesGrupo(textos);
}

function chaveGrupoOs(trabalho: Trabalho) {
  return trabalho.grupoOsId || trabalho.id;
}

function instrucoesConsolidadas(trabalho: Trabalho, trabalhos: Trabalho[]) {
  const grupo = trabalhos.filter((item) => chaveGrupoOs(item) === chaveGrupoOs(trabalho));
  if (grupo.length <= 1) return trabalho.instrucoes || "";
  return grupo
    .map((item) => item.instrucoes || "")
    .filter(Boolean)
    .join("\n");
}

const dentesSuperiores = ["18", "17", "16", "15", "14", "13", "12", "11", "21", "22", "23", "24", "25", "26", "27", "28"];
const dentesInferiores = ["48", "47", "46", "45", "44", "43", "42", "41", "31", "32", "33", "34", "35", "36", "37", "38"];
const dentesDeciduosSuperiores = [...DENTES_DECIDUOS_SUPERIORES];
const dentesDeciduosInferiores = [...DENTES_DECIDUOS_INFERIORES];

type TipoDenticao = "permanente" | "deciduos";

function dentesPorDenticaoControle(tipo: TipoDenticao) {
  return tipo === "deciduos"
    ? { superiores: dentesDeciduosSuperiores, inferiores: dentesDeciduosInferiores }
    : { superiores: dentesSuperiores, inferiores: dentesInferiores };
}

function tipoDenticaoFromDentesControle(valores: string[]): TipoDenticao {
  return tipoDenticaoFromNumerosDentes(valores);
}

function dentesFromResumoControle(resumo: string, tipo: TipoDenticao = "permanente") {
  const { superiores, inferiores } = dentesPorDenticaoControle(tipo);
  const partes = resumo.split(",").map((parte) => parte.trim()).filter(Boolean);
  return Array.from(
    new Set(
      partes.flatMap((parte) => {
        if (parte === "SUP") return superiores;
        if (parte === "INF") return inferiores;
        return /^\d+$/.test(parte) ? [parte] : [];
      })
    )
  );
}

function numeroDenteResumoControle(dentes: string[], tipo: TipoDenticao) {
  const { superiores, inferiores } = dentesPorDenticaoControle(tipo);
  const todosSuperiores = superiores.every((dente) => dentes.includes(dente));
  const todosInferiores = inferiores.every((dente) => dentes.includes(dente));
  const superioresExtras = dentes.filter((dente) => !superiores.includes(dente));
  const inferioresExtras = dentes.filter((dente) => !inferiores.includes(dente));
  const partes = [
    todosSuperiores ? "SUP" : "",
    todosInferiores ? "INF" : "",
    ...(!todosSuperiores ? dentes.filter((dente) => superiores.includes(dente)) : []),
    ...(!todosInferiores ? dentes.filter((dente) => inferiores.includes(dente)) : []),
  ].filter(Boolean);

  if (todosSuperiores && todosInferiores) return "SUP, INF";
  if (todosSuperiores && superioresExtras.length === inferiores.length) return "SUP, INF";
  if (todosInferiores && inferioresExtras.length === superiores.length) return "SUP, INF";
  return partes.length ? partes.join(", ") : "";
}

function renderDentesSelecionadosControle(resumo: string) {
  if (!resumo.trim()) {
    return <span className="font-normal text-slate-600">Nenhum dente selecionado</span>;
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {resumo.split(", ").map((parte) =>
        parte === "SUP" || parte === "INF" ? (
          <span key={parte} className="rounded bg-emerald-500 px-2 py-1 text-[11px] font-bold text-white">
            {parte}
          </span>
        ) : (
          <span
            key={parte}
            className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-emerald-500 px-1.5 text-[10px] font-bold text-white"
          >
            {parte}
          </span>
        )
      )}
    </span>
  );
}

function itemIdEtapasControle(
  trabalho: Pick<
    Trabalho,
    | "id"
    | "numeroOs"
    | "tipoProtese"
    | "valor"
    | "status"
    | "instrucoes"
    | "dataEntrada"
    | "dataPrevista"
  >,
  editItemId?: string | null
) {
  const itens = itensDaOsModulo({
    id: trabalho.id,
    numeroOs: trabalho.numeroOs,
    tipoProtese: trabalho.tipoProtese,
    valor: trabalho.valor ?? 0,
    status: trabalho.status,
    instrucoes: trabalho.instrucoes,
    dataEntrada: trabalho.dataEntrada,
    dataPrevista: trabalho.dataPrevista,
  });
  if (editItemId) {
    const hit = itens.find((item) => item.id === editItemId);
    if (hit) return hit.id;
  }
  return (
    itens.find((item) => item.tipo === "trabalho")?.id ??
    itens[0]?.id ??
    `${trabalho.id}-principal`
  );
}

export default function ControlePage() {
  const searchParams = useSearchParams();
  const painelInicial = searchParams.get("painel");
  const prazoInicial: TipoPrazoProducao =
    searchParams.get("prazo") === "dentista" ? "dentista" : "lab";
  const diaVencendo = searchParams.get("dia") || "hoje";
  const painelDestaque = searchParams.get("destaque");
  const [trabalhos, setTrabalhos] = useState<Trabalho[]>([]);
  const [busca, setBusca] = useState("");
  const statusUrl = searchParams.get("status");
  const [status, setStatus] = useState(
    statusUrl && statusUrl !== "todos" ? statusUrl : "todos"
  );
  const [cliente, setCliente] = useState("");
  const [dataEntrada, setDataEntrada] = useState("");
  const [osAberta, setOsAberta] = useState<string | null>(null);
  const [editando, setEditando] = useState<Trabalho | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [itemSelecionadoId, setItemSelecionadoId] = useState<string | null>(null);
  const [abaServicoEdicao, setAbaServicoEdicao] = useState<AbaServicoEdicao>("etapas");
  const [tipoDenticao, setTipoDenticao] = useState<TipoDenticao>("permanente");
  const [dentesEdicao, setDentesEdicao] = useState<string[]>([]);
  const [painelEdicaoItem, setPainelEdicaoItem] = useState<PainelEdicaoItem>("servico");
  const [adicionandoServico, setAdicionandoServico] = useState(false);
  const [produtosCadastro, setProdutosCadastro] = useState<ProdutoCadastro[]>([]);
  const [produtosOs, setProdutosOs] = useState<ProdutoOsEdicao[]>([]);
  const [grupoOsRegistros, setGrupoOsRegistros] = useState<RegistroGrupoOs[]>([]);
  const [etapasEdicao, setEtapasEdicao] = useState<EtapaOsFormLinha[]>([]);
  const [indiceEtapaAtualEdicao, setIndiceEtapaAtualEdicao] = useState(0);
  const [colaboradoresEdicao, setColaboradoresEdicao] = useState<
    { nome: string; comissao: string; etapa: string }[]
  >([]);
  const [terceirizadosEdicao, setTerceirizadosEdicao] = useState<
    { nome: string; servico: string; custo: string }[]
  >([]);
  const [colaboradoresOpcoes, setColaboradoresOpcoes] = useState<ColaboradorListagem[]>([]);
  const [opcoesTerceirizados, setOpcoesTerceirizados] = useState<TerceirizadoOpcao[]>([]);
  const [categoriasTabelaPreco, setCategoriasTabelaPreco] = useState<CategoriaTabelaPrecoOs[]>([]);
  const [lancamentosFatura, setLancamentosFatura] = useState<LancamentoFaturaOs[]>([]);

  const painelEdicaoVisivel = Boolean(itemSelecionadoId || adicionandoServico);
  const modelosEtapasOs = useMemo(() => carregarEtapasCadastro(), [editando]);
  const linhasComplementosEdicao = useMemo(
    () => montarLinhasComplementosOs(colaboradoresEdicao, terceirizadosEdicao),
    [colaboradoresEdicao, terceirizadosEdicao]
  );

  const osFaturada = useMemo(() => {
    if (!editando) return false;
    return grupoOsEstaFaturado(editando, trabalhos, lancamentosFatura);
  }, [editando, trabalhos, lancamentosFatura]);

  function trabalhoGrupoFaturado(trabalho: Trabalho) {
    return grupoOsEstaFaturado(trabalho, trabalhos, lancamentosFatura);
  }

  const servicosDaCategoriaEdicao = useMemo(
    () => servicosSelecionaveisNaOs(servicosDaCategoriaTabela(categoriasTabelaPreco, form?.categoria || "")),
    [categoriasTabelaPreco, form?.categoria]
  );

  const servicoOsAtualEdicao = useMemo(() => {
    const nome = form?.tipoProtese?.trim() || "";
    if (!nome || /^(transporte|frete|produto)\s*:/i.test(nome)) return undefined;
    return buscarServicoNaTabela(categoriasTabelaPreco, nome);
  }, [form?.tipoProtese, categoriasTabelaPreco]);

  const comissoesColaboradoresServicoEdicao = useMemo(
    () => comissoesColaboradoresDoServico(servicoOsAtualEdicao),
    [servicoOsAtualEdicao]
  );

  const comissoesTerceirizadosServicoEdicao = useMemo(
    () => comissoesTerceirizadosDoServico(servicoOsAtualEdicao),
    [servicoOsAtualEdicao]
  );
  const [anexoAberto, setAnexoAberto] = useState<AnexoOs | null>(null);
  const [osExcluindo, setOsExcluindo] = useState<Trabalho | null>(null);
  const [statusEditando, setStatusEditando] = useState<Trabalho | null>(null);
  const [statusForm, setStatusForm] = useState<StatusForm>({
    status: "",
    dataPrevista: "",
    observacoes: "",
    instrucoes: "",
  });
  const [filtroProdutos, setFiltroProdutos] = useState(false);
  const [filtroFichasSemServicos, setFiltroFichasSemServicos] = useState(false);
  const [imprimirOs, setImprimirOs] = useState<Trabalho | null>(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [avisoConfirmarItem, setAvisoConfirmarItem] = useState("");

  async function load() {
    const params = new URLSearchParams();
    if (busca) params.set("q", busca);
    if (status && status !== "todos") params.set("status", status);
    const dataIso = brShortToIso(dataEntrada);
    if (dataIso) params.set("dataEntrada", dataIso);
    const res = await fetch(`/api/trabalhos?${params.toString()}`);
    const data = await res.json();
    setTrabalhos(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [busca, status, dataEntrada]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const produtosSalvo =
        readStorage<string | null>("labProteseControleProdutos", null) ??
        readStorage<string | null>("labProteseControleProdutor", null);
      setFiltroProdutos(produtosSalvo === "1");
      setFiltroFichasSemServicos(
        readStorage<string | null>("labProteseControleFichasSemServicos", null) === "1"
      );
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (painelInicial === "vencendo" || painelInicial === "atrasados") {
      setStatus("todos");
    } else if (statusUrl && statusUrl !== "todos") {
      setStatus(statusUrl);
    }
  }, [painelInicial, statusUrl]);

  const filtrados = useMemo(() => {
    let lista = trabalhos.filter((trabalho) =>
      cliente ? clienteNome(trabalho) === cliente : true
    );
    if (painelInicial === "vencendo") {
      lista = filtrarTrabalhosVencendoPeriodo(lista, prazoInicial, diaVencendo);
    } else if (painelInicial === "atrasados") {
      lista = filtrarTrabalhosAtrasados(lista, prazoInicial);
    }

    const filtrosControle = { filtroProdutos, filtroFichasSemServicos };
    const baseGrupo = trabalhos.filter((t) =>
      cliente ? clienteNome(t) === cliente : true
    );

    lista = lista.filter((trabalho) => {
      const primeiroItem = parseItens(trabalho)[0];
      const grupo = trabalhosDoMesmoGrupoOsId(trabalho, baseGrupo);
      return deveExibirTrabalhoNoControleProducao(
        trabalho,
        grupo,
        filtrosControle,
        primeiroItem
      );
    });

    return expandirControleProducaoComServicoDoGrupo(lista, baseGrupo, filtrosControle);
  }, [
    trabalhos,
    cliente,
    painelInicial,
    prazoInicial,
    diaVencendo,
    filtroProdutos,
    filtroFichasSemServicos,
  ]);

  const listagem = useListagemPaginada<Trabalho, CampoOrdenacaoControle>({
    storageKey: "controle-producao",
    itens: filtrados,
    padrao: {
      ordenarPor: "numeroOs",
      direcao: "desc",
      porPagina: 50,
    },
    comparadores: COMPARADORES_CONTROLE,
  });

  const gruposPorNumeroOs = useMemo(() => {
    const mapa = new Map<number, Trabalho[]>();
    for (const t of trabalhos) {
      const lista = mapa.get(t.numeroOs) ?? [];
      lista.push(t);
      mapa.set(t.numeroOs, lista);
    }
    return mapa;
  }, [trabalhos]);

  useEffect(() => {
    if (searchParams.get("imprimir") !== "1") return;
    const timer = window.setTimeout(() => window.print(), 600);
    return () => window.clearTimeout(timer);
  }, [searchParams]);

  useEffect(() => {
    if (!painelDestaque || trabalhos.length === 0) return;
    const alvo = trabalhos.find((t) => t.id === painelDestaque);
    if (alvo) setOsAberta(alvo.id);
  }, [painelDestaque, trabalhos]);

  useEffect(() => {
    fetch("/api/financeiro?tipo=receita", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { lancamentos: [] }))
      .then((data) =>
        setLancamentosFatura(Array.isArray(data?.lancamentos) ? data.lancamentos : [])
      )
      .catch(() => setLancamentosFatura([]));
  }, []);

  useEffect(() => {
    if (!editando) return;
    fetch("/api/produtos")
      .then((res) => res.json())
      .then((data) => setProdutosCadastro(Array.isArray(data) ? data : []))
      .catch(() => setProdutosCadastro([]));

    const porTabela = carregarCategoriasPorTabelaPreco();
    const tabela = "Tabela Principal";
    setCategoriasTabelaPreco(porTabela[tabela] || Object.values(porTabela)[0] || []);
    setColaboradoresOpcoes(carregarColaboradoresListagem());
    setOpcoesTerceirizados(carregarOpcoesTerceirizadosControle());
  }, [editando]);

  const editIdPorGrupo = useMemo(() => {
    const mapa = new Map<string, string>();
    const porGrupo = new Map<string, Trabalho[]>();
    for (const trabalho of trabalhos) {
      const chave = trabalho.grupoOsId || trabalho.id;
      const lista = porGrupo.get(chave) || [];
      lista.push(trabalho);
      porGrupo.set(chave, lista);
    }
    porGrupo.forEach((grupo, chave) => {
      mapa.set(chave, editIdPreferidoGrupo(grupo) || grupo[0].id);
    });
    return mapa;
  }, [trabalhos]);

  function editIdTrabalho(trabalho: Trabalho) {
    return editIdPorGrupo.get(trabalho.grupoOsId || trabalho.id) || trabalho.id;
  }

  const totalServicoEdicao = useMemo(() => {
    if (!form) return 0;
    const usandoCamposProduto = painelEdicaoItem === "produto" || abaServicoEdicao === "produtos";
    if (usandoCamposProduto && produtosOs[0]) {
      return valorTotalLinhaProdutoOs(produtosOs[0]);
    }
    const subtotal =
      parseCurrencyBr(form.valor) * (Number(form.quantidade || 1) || 1);
    return valorComDescontoControle(subtotal, form.descontoTipo, form.desconto);
  }, [form, painelEdicaoItem, abaServicoEdicao, produtosOs]);

  const totalItensEdicao = useMemo(
    () =>
      editItems.reduce(
        (sum, item) => sum + valorComDescontoControle(item.valor, item.descontoTipo, item.desconto),
        0
      ),
    [editItems]
  );

  useEffect(() => {
    if (!editando || !form) return;
    setTerceirizadosEdicao((atuais) => {
      let changed = false;
      const atualizados = atuais.map((item) => {
        const opcao = opcoesTerceirizados.find(
          (terceirizado) => terceirizado.nome === item.nome && terceirizado.origem === "prestador"
        );
        if (!opcao) return item;
        const percentual = parsePercentualControle(
          form.repeticao ? opcao.valorComissaoRepeticao : opcao.valorComissao
        );
        const custo = (totalItensEdicao * (percentual / 100)).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });
        if (item.custo === custo) return item;
        changed = true;
        return { ...item, custo };
      });
      return changed ? atualizados : atuais;
    });
  }, [totalItensEdicao, form?.repeticao, opcoesTerceirizados, editando]);

  const clientes = Array.from(
    new Set(trabalhos.map(clienteNome).filter(Boolean))
  );

  function formVazioEdicao(trabalho: Trabalho, todos: Trabalho[] = trabalhos): EditForm {
    const complementos = complementosEdicaoTrabalho(trabalho, todos);
    const corpo = instrucoesCorpoSemEtapas(
      instrucoesCorpoSemItens(instrucoesConsolidadas(trabalho, todos))
    );
    const dataBr = formatDate(trabalho.dataPrevista);
    return {
      categoria: trabalho.escala || "",
      tipoProtese: trabalho.tipoProtese,
      dentes: trabalho.dentes || "",
      cor: trabalho.cor || "",
      escalaCor: trabalho.escala || trabalho.cor || "",
      material: trabalho.material || "",
      status: trabalho.status,
      valor: (trabalho.valor || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      }),
      quantidade: "1",
      descontoTipo: "percentual",
      desconto: "0,00",
      dataPrevista: dateToInput(trabalho.dataPrevista),
      dataLaboratorio: dataBr,
      horaLaboratorio: "",
      dataDentista: dataBr,
      horaDentista: "",
      observacoes: trabalho.observacoes || "",
      observacaoServico: "",
      instrucoesCorpo: complementos.textoLivre || corpo,
      urgente: false,
      repeticao: false,
    };
  }

  function valorSelectServicoEdicao() {
    if (!form) return "";
    const texto = form.tipoProtese.trim();
    if (/^(transporte|frete)\s*:/i.test(texto)) {
      return texto.replace(/^(transporte|frete)\s*:/i, "").trim();
    }
    return texto;
  }

  function prazosDoServicoEdicao(nomeServico: string) {
    const servico = buscarServicoNaTabela(categoriasTabelaPreco, nomeServico);
    const base = parseBrDate(formatDate(editando?.dataEntrada)) || new Date();
    return servico ? calcularDatasPrazoServico(servico, base) : { dataLaboratorio: "", dataDentista: "" };
  }

  function selecionarCategoriaServicoEdicao(categoriaNome: string) {
    setForm((atual) =>
      atual
        ? {
            ...atual,
            categoria: categoriaNome,
            tipoProtese: "",
            valor: "R$ 0,00",
            dataLaboratorio: "",
            dataDentista: "",
          }
        : atual
    );
  }

  function selecionarServicoTabelaEdicao(servicoRef: string) {
    if (!form) return;
    if (!servicoRef) {
      setForm((atual) =>
        atual
          ? { ...atual, tipoProtese: "", valor: "R$ 0,00", dataLaboratorio: "", dataDentista: "" }
          : atual
      );
      return;
    }

    const servico = buscarServicoNaTabela(categoriasTabelaPreco, servicoRef);
    if (!servico) return;

    const valorFmt = servico.valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

    if (servico.tipo === "transporte") {
      setForm((atual) =>
        atual
          ? {
              ...atual,
              tipoProtese: `Transporte: ${servico.nome}`,
              valor: valorFmt,
              quantidade: "1",
              dataLaboratorio: "",
              dataDentista: "",
            }
          : atual
      );
      return;
    }

    const prazos = prazosDoServicoEdicao(servico.nome);
    setForm((atual) =>
      atual
        ? {
            ...atual,
            tipoProtese: servico.nome,
            valor: valorFmt,
            dataLaboratorio: prazos.dataLaboratorio,
            dataDentista: prazos.dataDentista,
            dataPrevista: brShortToIso(prazos.dataLaboratorio) || atual.dataPrevista,
          }
        : atual
    );
  }

  function fecharEdicaoOs() {
    setAvisoConfirmarItem("");
    setEditando(null);
    setForm(null);
    setEditItems([]);
    setGrupoOsRegistros([]);
    setItemSelecionadoId(null);
    setAbaServicoEdicao("etapas");
    setPainelEdicaoItem("servico");
    setAdicionandoServico(false);
    setProdutosOs([]);
    setEtapasEdicao([]);
    setIndiceEtapaAtualEdicao(0);
    setColaboradoresEdicao([]);
    setTerceirizadosEdicao([]);
    setColaboradoresOpcoes([]);
    setOpcoesTerceirizados([]);
    setTipoDenticao("permanente");
    setDentesEdicao([]);
    setLancamentosFatura([]);
  }

  function sincronizarIndiceEtapaAtualEdicao(
    trabalho: Trabalho,
    totalEtapas: number,
    editItemId?: string | null
  ) {
    if (totalEtapas <= 0) {
      setIndiceEtapaAtualEdicao(0);
      return;
    }
    const chave = `${trabalho.id}:${itemIdEtapasControle(trabalho, editItemId)}`;
    const concluidas = etapasConcluidasModulo(chave);
    setIndiceEtapaAtualEdicao(indiceEtapaAtualDeConcluidas(concluidas, totalEtapas));
  }

  async function persistirEtapaAtualEdicaoOs() {
    if (!editando || etapasEdicao.length === 0) return;
    const itemServico = itemSelecionadoId
      ? editItems.find(
          (item) => item.id === itemSelecionadoId && classificarItemOs(item) === "servico"
        )
      : editItems.find((item) => classificarItemOs(item) === "servico");
    const registroServico =
      grupoOsRegistros.find((item) => (item.segmentoFaturamento || "servico") === "servico") ||
      grupoOsRegistros[0];
    const trabalhoRef: Trabalho = {
      ...editando,
      id: registroServico?.id ?? editando.id,
      instrucoes: registroServico?.instrucoes ?? editando.instrucoes,
      tipoProtese: registroServico?.tipoProtese ?? editando.tipoProtese,
    };
    await persistirEtapaAtualOs({
      trabalhoId: trabalhoRef.id,
      itemId: itemIdEtapasControle(trabalhoRef, itemServico?.id ?? itemSelecionadoId),
      indiceAtual: Math.min(indiceEtapaAtualEdicao, etapasEdicao.length),
    });
  }

  function carregarComplementosNaEdicao(trabalho: Trabalho) {
    const complementos = complementosEdicaoTrabalho(trabalho, trabalhos);
    setColaboradoresEdicao(
      complementos.colaboradores.map((item) => ({
        nome: item.nome,
        comissao: exibirComissaoPercentual(item.comissao),
        etapa: item.etapa,
      }))
    );
    setTerceirizadosEdicao(
      complementos.terceirizados.map((item) => ({
        nome: item.nome,
        servico: item.servico,
        custo: item.custo,
      }))
    );
  }

  function comissaoColaboradorCadastroControle(cadastro: ColaboradorListagem) {
    const bruto =
      form?.repeticao && cadastro.comissaoRepeticao?.replace(/[^\d]/g, "") !== "000"
        ? cadastro.comissaoRepeticao
        : cadastro.comissaoPercentual || "0,00";
    return exibirComissaoPercentual(bruto) || "0,00%";
  }

  function selecionarColaboradorEdicao(index: number, nome: string) {
    if (nome) {
      const duplicata = colaboradoresEdicao.findIndex((item, i) => i !== index && item.nome === nome);
      if (duplicata >= 0) {
        setColaboradoresEdicao((atuais) => atuais.filter((_, i) => i !== index));
        return;
      }
    }
    const cadastro = colaboradoresOpcoes.find((item) => item.nome === nome);
    setColaboradoresEdicao((atuais) =>
      atuais.map((item, i) =>
        i === index
          ? {
              ...item,
              nome,
              comissao: cadastro ? comissaoColaboradorCadastroControle(cadastro) : item.comissao,
            }
          : item
      )
    );
  }

  function adicionarLinhaColaboradorEdicao() {
    setAbaServicoEdicao("colaboradores");
    const ultima = colaboradoresEdicao[colaboradoresEdicao.length - 1];
    if (ultima && !ultima.nome.trim() && !ultima.comissao.trim() && !ultima.etapa.trim()) return;
    setColaboradoresEdicao((atuais) => [...atuais, { nome: "", comissao: "", etapa: "" }]);
  }

  function valorComissaoTerceirizadoControle(opcao: TerceirizadoOpcao) {
    const percentual = parsePercentualControle(
      form?.repeticao ? opcao.valorComissaoRepeticao : opcao.valorComissao
    );
    return totalItensEdicao * (percentual / 100);
  }

  function selecionarTerceirizadoEdicao(index: number, nome: string) {
    const opcao = opcoesTerceirizados.find((item) => item.nome === nome);
    setTerceirizadosEdicao((atuais) =>
      atuais.map((item, i) =>
        i === index
          ? {
              ...item,
              nome,
              servico: opcao?.tipoServico || item.servico,
              custo:
                opcao?.origem === "prestador"
                  ? valorComissaoTerceirizadoControle(opcao).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })
                  : item.custo,
            }
          : item
      )
    );
  }

  function adicionarLinhaTerceirizadoEdicao() {
    setAbaServicoEdicao("terceiros");
    setTerceirizadosEdicao((atuais) => [...atuais, { nome: "", servico: "", custo: "" }]);
  }

  function carregarEtapasNaEdicao(trabalho: Trabalho) {
    const complementos = complementosEdicaoTrabalho(trabalho, trabalhos);
    const modelos = carregarEtapasCadastro();
    const etapasForm = etapasOsLinhaParaForm(complementos.etapas).map((etapa) => ({
      ...etapa,
      setor: modelos.find((m) => m.nome === etapa.nome)?.setor || "",
    }));
    setEtapasEdicao(etapasForm);
    sincronizarIndiceEtapaAtualEdicao(trabalho, etapasForm.length, itemSelecionadoId);
  }

  function linhasEtapasItemControle(item: EditItem) {
    const filtradas = etapasFormParaItemServico(
      item.servico,
      etapasEdicao,
      categoriasTabelaPreco,
      carregarEtapasCadastro(),
      { somentePreenchidasNoForm: true }
    );
    return etapasFormParaLinhasInstrucoes(filtradas, {
      prazoGeral: form?.dataLaboratorio,
      quantidadeDentes: dentesEdicao.length || 1,
    });
  }

  function carregarEtapasDoItemServico(item: EditItem, trabalhoRef?: Trabalho) {
    const base = trabalhoRef ?? editando;
    if (!base) return;
    const grupo = trabalhosDoMesmoGrupoOsId(base, trabalhos);
    const nomeItem = item.servico.trim().toLowerCase();
    const registro =
      grupo.find(
        (t) =>
          segmentoEfetivoTrabalho(t) === "servico" &&
          (t.tipoProtese || "").trim().toLowerCase() === nomeItem
      ) || base;
    const complementos = parseComplementosInstrucoesGrupo([registro.instrucoes || ""]);
    const modelos = carregarEtapasCadastro();
    const etapasForm = etapasOsLinhaParaForm(complementos.etapas).filter((e) =>
      e.nome.trim()
    );
    const etapasCarregadas =
      etapasForm.length > 0
        ? etapasForm.map((etapa) => ({
            ...etapa,
            setor: modelos.find((m) => m.nome === etapa.nome)?.setor || etapa.setor || "",
          }))
        : [{ nome: "", setor: "", responsavel: "", prazo: "", observacao: "" }];
    setEtapasEdicao(etapasCarregadas);
    sincronizarIndiceEtapaAtualEdicao(base, etapasCarregadas.length, item.id);
  }

  function classeAbaEdicao(aba: AbaServicoEdicao) {
    return abaServicoEdicao === aba
      ? "rounded px-3 py-2 text-xs font-medium bg-primary-600 text-white shadow"
      : "px-1 py-2 text-xs font-medium text-slate-700 hover:text-primary-700";
  }

  function sincronizarDentesNoFormulario(dentes: string[], tipo: TipoDenticao = tipoDenticao) {
    const resumo = numeroDenteResumoControle(dentes, tipo);
    setDentesEdicao(dentes);
    setForm((atual) => (atual ? { ...atual, dentes: resumo } : atual));
  }

  function toggleDenteEdicao(dente: string) {
    setDentesEdicao((atual) => {
      const prox = atual.includes(dente) ? atual.filter((d) => d !== dente) : [...atual, dente];
      const resumo = numeroDenteResumoControle(prox, tipoDenticao);
      setForm((f) => (f ? { ...f, dentes: resumo } : f));
      return prox;
    });
  }

  function selecionarArcadaEdicao(arcada: "sup" | "inf") {
    const { superiores, inferiores } = dentesPorDenticaoControle(tipoDenticao);
    const linha = arcada === "sup" ? superiores : inferiores;
    setDentesEdicao((atual) => {
      const todosSelecionados = linha.every((dente) => atual.includes(dente));
      const prox = todosSelecionados
        ? atual.filter((dente) => !linha.includes(dente))
        : Array.from(new Set([...atual, ...linha]));
      const resumo = numeroDenteResumoControle(prox, tipoDenticao);
      setForm((f) => (f ? { ...f, dentes: resumo } : f));
      return prox;
    });
  }

  function trocarTipoDenticaoEdicao(tipo: TipoDenticao) {
    setTipoDenticao(tipo);
    sincronizarDentesNoFormulario([], tipo);
  }

  function abrirEdicao(trabalho: Trabalho) {
    const idAlvo = editIdTrabalho(trabalho);
    const alvo = trabalhos.find((item) => item.id === idAlvo) || trabalho;
    const grupo = trabalhosDoMesmoGrupoOsId(alvo, trabalhos);
    const itens = grupo.flatMap((t) => parseItens(t));
    setGrupoOsRegistros(
      grupo.map((item) => ({
        id: item.id,
        segmentoFaturamento: (item.segmentoFaturamento || "servico") as SegmentoFaturamento,
        instrucoes: item.instrucoes,
        tipoProtese: item.tipoProtese,
      }))
    );
    const dentesIniciais = dentesFromResumoControle(alvo.dentes || "");
    const denticaoInicial = tipoDenticaoFromDentesControle(dentesIniciais);
    setEditando(alvo);
    setEditItems(itens);
    setItemSelecionadoId(null);
    setAbaServicoEdicao("etapas");
    setPainelEdicaoItem("servico");
    setAdicionandoServico(false);
    setProdutosOs([]);
    setTipoDenticao(denticaoInicial);
    setDentesEdicao(dentesIniciais);
    setForm({
      ...formVazioEdicao(alvo, trabalhos),
      dentes: numeroDenteResumoControle(dentesIniciais, denticaoInicial),
    });
    const primeiroServico = itens.find((item) => classificarItemOs(item) === "servico");
    carregarComplementosNaEdicao(alvo);
    if (primeiroServico) {
      carregarEtapasDoItemServico(primeiroServico, alvo);
    } else {
      carregarEtapasNaEdicao(alvo);
    }

    if (primeiroServico && trabalhoGrupoFaturado(alvo)) {
      setItemSelecionadoId(primeiroServico.id);
      setPainelEdicaoItem("servico");
      setAbaServicoEdicao("colaboradores");
    }
  }

  function abrirAbaComissoesEdicao(aba: "colaboradores" | "terceiros") {
    if (!itemSelecionadoId && !adicionandoServico) {
      const primeiroServico = editItems.find((item) => classificarItemOs(item) === "servico");
      if (primeiroServico) {
        selecionarItemEdicao(primeiroServico);
      }
    }
    setPainelEdicaoItem("servico");
    setAbaServicoEdicao(aba);
  }

  function selecionarItemEdicao(item: EditItem) {
    const painel = tipoPainelEdicaoItem(item);
    setAdicionandoServico(false);
    setItemSelecionadoId(item.id);
    setPainelEdicaoItem(painel);
    const qtd = Number(item.quantidade || 1) || 1;
    const unitario = item.valor / qtd;

    if (painel === "produto") {
      setAbaServicoEdicao("produtos");
      const nomeProduto = nomeExibicaoItemOs(item);
      const produto = produtosCadastro.find(
        (p) => p.id === item.produtoId || p.nome === nomeProduto
      );
      setProdutosOs([
        {
          produtoId: produto?.id || item.produtoId || "",
          quantidade: item.quantidade || "1",
          valorUnitario: formatCurrency(unitario || 0),
          valor: formatCurrency(item.valor),
          observacao: item.observacao || nomeProduto,
        },
      ]);
      setForm((atual) => ({
        ...(atual || formVazioEdicao(editando!)),
        quantidade: item.quantidade || "1",
        valor: formatCurrency(item.valor),
        urgente: Boolean(item.urgente),
        repeticao: Boolean(item.repeticao),
        observacaoServico: "",
      }));
      return;
    }

    if (painel === "transporte") {
      setProdutosOs([]);
      setForm((atual) => ({
        ...(atual || formVazioEdicao(editando!)),
        tipoProtese: item.servico,
        quantidade: item.quantidade || "1",
        valor: unitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
        urgente: Boolean(item.urgente),
        repeticao: Boolean(item.repeticao),
        observacaoServico: "",
      }));
      return;
    }

    setAbaServicoEdicao("etapas");
    setProdutosOs([]);
    carregarEtapasDoItemServico(item);
    const resumoDentes = item.numeroDente === "-" ? "" : item.numeroDente;
    const dentesItem = dentesFromResumoControle(resumoDentes);
    const denticaoItem = tipoDenticaoFromDentesControle(dentesItem);
    setTipoDenticao(denticaoItem);
    setDentesEdicao(dentesItem);
    const descontoItem = item.desconto || "0,00";
    setForm((atual) => ({
      ...(atual || formVazioEdicao(editando!)),
      categoria:
        item.categoria ||
        categoriaDoServicoNaTabela(categoriasTabelaPreco, item.servico) ||
        editando!.escala ||
        "",
      tipoProtese: item.servico,
      dentes: numeroDenteResumoControle(dentesItem, denticaoItem) || resumoDentes,
      cor: item.corDente === "-" ? "" : item.corDente,
      escalaCor: item.corDente === "-" ? "" : item.corDente,
      quantidade: item.quantidade || "1",
      valor: unitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      descontoTipo: item.descontoTipo || (descontoItem.startsWith("R$") ? "valor" : "percentual"),
      desconto: descontoItem,
      status: item.situacao || editando!.status,
      urgente: Boolean(item.urgente),
      repeticao: Boolean(item.repeticao),
      observacaoServico: item.observacao || "",
    }));
  }

  function itemEdicaoEquivalente(a: EditItem, b: EditItem) {
    return (
      a.servico === b.servico &&
      (a.categoria || "") === (b.categoria || "") &&
      a.numeroDente === b.numeroDente &&
      a.corDente === b.corDente &&
      a.quantidade === b.quantidade &&
      Math.abs(a.valor - b.valor) < 0.01 &&
      (a.descontoTipo || "") === (b.descontoTipo || "") &&
      (a.desconto || "") === (b.desconto || "") &&
      (a.situacao || "") === (b.situacao || "") &&
      Boolean(a.urgente) === Boolean(b.urgente) &&
      Boolean(a.repeticao) === Boolean(b.repeticao) &&
      (a.observacao || "") === (b.observacao || "") &&
      (a.produtoId || "") === (b.produtoId || "")
    );
  }

  function temAlteracoesPendentesItemEdicao() {
    if (!itemSelecionadoId || !form) return false;
    const base = editItems.find((item) => item.id === itemSelecionadoId);
    if (!base) return false;
    const atualizado = montarItemEdicaoAtual();
    if (!atualizado) return false;
    return !itemEdicaoEquivalente(base, atualizado);
  }

  function formularioNovoServicoPendente() {
    if (!adicionandoServico || !form) return false;
    return Boolean(form.tipoProtese.trim()) || dentesEdicao.length > 0;
  }

  function montarItemEdicaoAtual(): EditItem | null {
    if (!itemSelecionadoId || !form) return null;
    const base = editItems.find((item) => item.id === itemSelecionadoId);
    if (!base) return null;

    if (painelEdicaoItem === "produto") {
      const produtoOs = produtosOs[0];
      if (!produtoOs) return null;
      const produto = produtosCadastro.find((p) => p.id === produtoOs.produtoId);
      const nome = produto?.nome || produtoOs.observacao?.trim() || "Produto";
      const quantidade = produtoOs.quantidade || "1";
      return {
        ...base,
        servico: `Produto: ${nome}`,
        numeroDente: "-",
        corDente: "-",
        quantidade,
        valor: valorTotalLinhaProdutoOs(produtoOs),
        produtoId: produtoOs.produtoId || undefined,
        observacao: produtoOs.observacao,
        urgente: form.urgente,
        repeticao: form.repeticao,
      };
    }

    if (painelEdicaoItem === "transporte") {
      const nomeCampo = form.tipoProtese.trim();
      const nome = /^(transporte|frete)\s*:/i.test(nomeCampo)
        ? nomeCampo
        : `Transporte: ${nomeExibicaoItemOs({ servico: nomeCampo })}`;
      const quantidade = form.quantidade || "1";
      const valorLinha = parseCurrencyBr(form.valor) * (Number(quantidade) || 1);
      return {
        ...base,
        servico: nome,
        numeroDente: "-",
        corDente: "-",
        quantidade,
        valor: valorLinha,
        urgente: form.urgente,
        repeticao: form.repeticao,
      };
    }

    const qtd = Number(form.quantidade || 1) || 1;
    return {
      ...base,
      servico: form.tipoProtese,
      categoria: form.categoria,
      numeroDente: form.dentes || "-",
      corDente: form.escalaCor || form.cor || "-",
      quantidade: form.quantidade || "1",
      valor: parseCurrencyBr(form.valor) * qtd,
      descontoTipo: form.descontoTipo,
      desconto: form.desconto,
      situacao: form.status,
      urgente: form.urgente,
      repeticao: form.repeticao,
      observacao: form.observacaoServico.trim() || undefined,
    };
  }

  function aplicarFormularioAoItemSelecionado() {
    if (!itemSelecionadoId || !form) return;
    const atualizado = montarItemEdicaoAtual();
    if (!atualizado) return;
    setEditItems((itens) =>
      itens.map((item) => (item.id === itemSelecionadoId ? atualizado : item))
    );
    setAvisoConfirmarItem("");
  }

  function novoItemProdutoEdicao(): EditItem | null {
    const produtoOs = produtosOs[0];
    if (!produtoOs?.produtoId && !produtoOs?.observacao?.trim()) return null;
    const produto = produtosCadastro.find((p) => p.id === produtoOs.produtoId);
    const nome = produto?.nome || produtoOs.observacao?.trim() || "Produto";
    const quantidade = produtoOs.quantidade || "1";
    return {
      id: `${Date.now()}`,
      servico: `Produto: ${nome}`,
      numeroDente: "-",
      corDente: "-",
      quantidade,
      valor: valorTotalLinhaProdutoOs(produtoOs),
      produtoId: produtoOs.produtoId || undefined,
      observacao: produtoOs.observacao,
    };
  }

  function novoItemTransporteEdicao(): EditItem | null {
    if (!form || !form.tipoProtese.trim()) return null;
    const quantidade = form.quantidade || "1";
    const nome = /^(transporte|frete)\s*:/i.test(form.tipoProtese.trim())
      ? form.tipoProtese.trim()
      : `Transporte: ${form.tipoProtese.trim()}`;
    return {
      id: `${Date.now()}`,
      servico: nome,
      numeroDente: "-",
      corDente: "-",
      quantidade,
      valor: parseCurrencyBr(form.valor || "R$ 0,00") * (Number(quantidade) || 1),
    };
  }

  function confirmarEdicaoItem() {
    if (osFaturada) return;
    const limparAvisoItem = () => setAvisoConfirmarItem("");
    if (itemSelecionadoId) {
      const itemSelecionado = editItems.find((item) => item.id === itemSelecionadoId);
      const selecionadoEhServico = itemSelecionado
        ? classificarItemOs(itemSelecionado) === "servico"
        : false;

      // Fluxo pedido: com serviço selecionado, lançar produto cria NOVO item.
      if (selecionadoEhServico && abaServicoEdicao === "produtos") {
        const novoProduto = novoItemProdutoEdicao();
        if (!novoProduto) return;
        setEditItems((atuais) => [...atuais, novoProduto]);
        selecionarItemEdicao(novoProduto);
        limparAvisoItem();
        return;
      }

      // Fluxo pedido: com serviço selecionado, lançar transporte cria NOVO item.
      const transporteNoFormulario =
        painelEdicaoItem === "transporte" ||
        (form ? /^(transporte|frete)\s*:/i.test(form.tipoProtese.trim()) : false);
      if (selecionadoEhServico && transporteNoFormulario) {
        const novoTransporte = novoItemTransporteEdicao();
        if (!novoTransporte) return;
        setEditItems((atuais) => [...atuais, novoTransporte]);
        selecionarItemEdicao(novoTransporte);
        limparAvisoItem();
        return;
      }

      aplicarFormularioAoItemSelecionado();
      return;
    }
    if (adicionandoServico && painelEdicaoItem === "servico" && abaServicoEdicao === "produtos") {
      const novo = novoItemProdutoEdicao();
      if (!novo) return;
      setEditItems((atuais) => [...atuais, novo]);
      setAdicionandoServico(false);
      setProdutosOs([]);
      setAbaServicoEdicao("etapas");
      limparAvisoItem();
      return;
    }
    if (!form) return;
    if (adicionandoServico && painelEdicaoItem === "servico") {
      if (!form.tipoProtese.trim() && dentesEdicao.length === 0) return;
      const quantidade = form.quantidade || "1";
      const novo: EditItem = {
        id: `${Date.now()}`,
        servico: form.tipoProtese.trim() || "Novo serviço",
        categoria: form.categoria,
        numeroDente: form.dentes || "-",
        corDente: form.escalaCor || form.cor || "-",
        quantidade,
        valor: parseCurrencyBr(form.valor) * (Number(quantidade) || 1),
        descontoTipo: form.descontoTipo,
        desconto: form.desconto,
        situacao: form.status,
        urgente: form.urgente,
        repeticao: form.repeticao,
        observacao: form.observacaoServico.trim() || undefined,
      };
      setEditItems((atuais) => [...atuais, novo]);
      setAdicionandoServico(false);
      setForm((atual) => (atual ? { ...atual, observacaoServico: "" } : atual));
      limparAvisoItem();
      return;
    }
    if (painelEdicaoItem === "produto") {
      const novo = novoItemProdutoEdicao();
      if (!novo) return;
      setEditItems((atuais) => [...atuais, novo]);
      selecionarItemEdicao(novo);
      limparAvisoItem();
      return;
    }
    if (painelEdicaoItem === "transporte") {
      const novo = novoItemTransporteEdicao();
      if (!novo) return;
      setEditItems((atuais) => [...atuais, novo]);
      selecionarItemEdicao(novo);
      limparAvisoItem();
    }
  }

  function abrirAdicionarServico() {
    if (!editando || osFaturada) return;
    setAdicionandoServico(true);
    setItemSelecionadoId(null);
    setPainelEdicaoItem("servico");
    setAbaServicoEdicao("etapas");
    setProdutosOs([]);
    setTipoDenticao("permanente");
    setDentesEdicao([]);
    setForm({
      ...formVazioEdicao(editando, trabalhos),
      categoria: "",
      tipoProtese: "",
      dentes: "",
      cor: "",
      escalaCor: "",
      quantidade: "1",
      valor: "R$ 0,00",
      descontoTipo: "percentual",
      desconto: "0,00",
      observacaoServico: "",
      urgente: false,
      repeticao: false,
    });
  }

  function limparSelecaoItemEdicao() {
    setItemSelecionadoId(null);
    setAdicionandoServico(false);
    setPainelEdicaoItem("servico");
    setProdutosOs([]);
    setAbaServicoEdicao("etapas");
    if (!editando) return;
    const dentesIniciais = dentesFromResumoControle(editando.dentes || "");
    const denticaoInicial = tipoDenticaoFromDentesControle(dentesIniciais);
    setTipoDenticao(denticaoInicial);
    setDentesEdicao(dentesIniciais);
    setForm({
      ...formVazioEdicao(editando, trabalhos),
      dentes: numeroDenteResumoControle(dentesIniciais, denticaoInicial),
    });
    carregarEtapasNaEdicao(editando);
  }

  async function salvarEdicao() {
    if (!editando || !form || salvandoEdicao) return;

    if (!osFaturada) {
      if (formularioNovoServicoPendente()) {
        setAvisoConfirmarItem("Clique em + Adicionar Serviço antes de gravar.");
        return;
      }
      if (temAlteracoesPendentesItemEdicao()) {
        setAvisoConfirmarItem("Clique em Atualizar Item Selecionado antes de gravar.");
        return;
      }
    }
    setAvisoConfirmarItem("");

    setSalvandoEdicao(true);
    try {
    if (osFaturada) {
      const registros =
        grupoOsRegistros.length > 0
          ? grupoOsRegistros
          : [
              {
                id: editando.id,
                segmentoFaturamento: (editando.segmentoFaturamento ||
                  "servico") as SegmentoFaturamento,
                instrucoes: editando.instrucoes,
                tipoProtese: editando.tipoProtese,
              },
            ];
      const servicoReg =
        registros.find((item) => (item.segmentoFaturamento || "servico") === "servico") ||
        registros[0];
      const instrucoesAtual = servicoReg.instrucoes || "";
      const corpoBase = removerComplementosOsDoCorpo(
        instrucoesCorpoSemItens(instrucoesSemAnexos(instrucoesAtual))
      );
      const etapasLinhas = parseEtapasInstrucoes(instrucoesAtual)
        .map((etapa) => formatarLinhaEtapa(etapa))
        .filter(Boolean)
        .join("\n");
      const corpoComComplementos = [corpoBase, etapasLinhas, linhasComplementosEdicao]
        .filter(Boolean)
        .join("\n");
      const itensServico = editItems.filter((item) => classificarItemOs(item) === "servico");
      const instrucoes = montarInstrucoesSegmentoControle(
        itensServico.length > 0 ? itensServico : editItems,
        corpoComComplementos,
        "",
        "servico"
      );
      const res = await fetch(`/api/trabalhos/${servicoReg.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          observacoes: form.observacoes ?? null,
          instrucoes: instrucoes || null,
        }),
      });
      if (!res.ok) {
        alert("Não foi possível gravar observação e comissões.");
        return;
      }
      fecharEdicaoOs();
      void load();
      return;
    }

    const itensSalvar = [...editItems];

    const blocosSalvar = planejarBlocosSalvarOs(itensSalvar);
    const dividir = blocosSalvar.length > 1 || deveDividirOs(itensSalvar);
    const corpoSemEtapas = instrucoesCorpoSemEtapas(form.instrucoesCorpo);
    const dataPrevistaIso = brShortToIso(form.dataLaboratorio) || form.dataPrevista || null;

    const payloadPutCompartilhado = {
      dentes: form.dentes || null,
      cor: form.escalaCor || form.cor || null,
      material: form.material || null,
      status: form.status,
      dataPrevista: dataPrevistaIso,
      observacoes: form.observacoes ?? null,
    };

    const payloadPostCompartilhado = bodyTrabalhoSemNull({
      status: form.status,
      ...(form.dentes ? { dentes: form.dentes } : {}),
      ...((form.escalaCor || form.cor) ? { cor: form.escalaCor || form.cor } : {}),
      ...(form.material ? { material: form.material } : {}),
      ...(dataPrevistaIso ? { dataPrevista: dataPrevistaIso } : {}),
      ...(form.observacoes ? { observacoes: form.observacoes } : {}),
    });

    async function salvarSegmentoExistente(
      id: string,
      segmento: SegmentoFaturamento,
      itens: EditItem[],
      opts?: {
        segmentoFaturamento?: SegmentoFaturamento;
        linhasEtapas?: string;
        tipoProtese?: string;
        dentes?: string | null;
      }
    ) {
      const item = itens[0];
      const dentes =
        opts?.dentes !== undefined
          ? opts.dentes
          : segmento === "servico" &&
              itens.length === 1 &&
              item?.numeroDente &&
              item.numeroDente !== "-"
            ? item.numeroDente
            : payloadPutCompartilhado.dentes;

      return fetch(`/api/trabalhos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payloadPutCompartilhado,
          dentes,
          ...(opts?.segmentoFaturamento
            ? { segmentoFaturamento: opts.segmentoFaturamento }
            : {}),
          escala: escalaOsParaSalvarControle(itens) || null,
          tipoProtese:
            opts?.tipoProtese ?? tituloSegmentoOs(itens, segmento, form!.tipoProtese),
          valor: valorItensControle(itens),
          instrucoes:
            montarInstrucoesSegmentoControle(
              itens,
              corpoSemEtapas,
              opts?.linhasEtapas ??
                etapasFormParaLinhasInstrucoes(etapasEdicao, {
                  prazoGeral: form!.dataLaboratorio,
                  quantidadeDentes: dentesEdicao.length || 1,
                }),
              segmento,
              segmento === "servico" ? linhasComplementosEdicao : undefined
            ) || null,
        }),
      });
    }

    const registros =
      grupoOsRegistros.length > 0
        ? grupoOsRegistros
        : [
            {
              id: editando.id,
              segmentoFaturamento: (editando.segmentoFaturamento ||
                "servico") as SegmentoFaturamento,
              instrucoes: editando.instrucoes,
              tipoProtese: editando.tipoProtese,
            },
          ];

    const promessas: Promise<Response>[] = [];

    if (dividir) {
      const idsUsados = new Set<string>();
      let dadosPost = dadosPostGrupoOsDeTrabalho(editando);

      if (!dadosPost) {
        const idsProbe = new Set<string>();
        const precisaCriarSegmento = blocosSalvar.some((bloco) => {
          const { reg } = buscarRegistroParaBlocoSalvar(registros, bloco, idsProbe);
          if (reg) {
            idsProbe.add(reg.id);
            return false;
          }
          return true;
        });
        if (precisaCriarSegmento) {
          const completo = await fetch(`/api/trabalhos/${editando.id}`).then((r) => r.json());
          dadosPost = dadosPostGrupoOsDeTrabalho(completo);
        }
      }

      for (const bloco of blocosSalvar) {
        const { reg, migrarSegmento } = buscarRegistroParaBlocoSalvar(
          registros,
          bloco,
          idsUsados
        );
        const servicoUnico =
          bloco.segmento === "servico" && bloco.itens.length === 1;
        const linhasEtapas = servicoUnico
          ? linhasEtapasItemControle(bloco.itens[0])
          : "";
        const tipoProtese = servicoUnico
          ? tituloTrabalhoServicoItem(bloco.itens[0])
          : tituloSegmentoOs(bloco.itens, bloco.segmento, form.tipoProtese);
        const dentesItem =
          servicoUnico && bloco.itens[0].numeroDente !== "-"
            ? bloco.itens[0].numeroDente
            : null;

        if (reg) {
          idsUsados.add(reg.id);
          promessas.push(
            salvarSegmentoExistente(reg.id, bloco.segmento, bloco.itens, {
              segmentoFaturamento: migrarSegmento,
              linhasEtapas,
              tipoProtese,
              dentes: dentesItem ?? payloadPutCompartilhado.dentes,
            })
          );
          continue;
        }

        if (!dadosPost) continue;

        promessas.push(
          fetch("/api/trabalhos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              bodyTrabalhoSemNull({
                ...payloadPostCompartilhado,
                clienteId: dadosPost.clienteId,
                pacienteId: dadosPost.pacienteId,
                numeroOs: dadosPost.numeroOs,
                grupoOsId: dadosPost.grupoOsId,
                segmentoFaturamento: bloco.segmento,
                tipoProtese,
                dataEntrada: new Date(dadosPost.dataEntrada).toISOString().slice(0, 10),
                dentes: dentesItem || undefined,
                escala: escalaOsParaSalvarControle(bloco.itens) || undefined,
                valor: valorItensControle(bloco.itens),
                instrucoes: montarInstrucoesSegmentoControle(
                  bloco.itens,
                  corpoSemEtapas,
                  linhasEtapas,
                  bloco.segmento,
                  bloco.segmento === "servico" ? linhasComplementosEdicao : undefined
                ),
              })
            ),
          })
        );
      }
    } else {
      const blocoUnico = blocosSalvar[0];
      const segmentoUnico = blocoUnico?.segmento ?? "servico";
      const { reg } = buscarRegistroParaBlocoSalvar(
        registros,
        blocoUnico ?? { segmento: segmentoUnico, itens: itensSalvar },
        new Set()
      );
      const alvo = reg || registros[0];
      const itensUnicos = blocoUnico?.itens ?? itensSalvar;
      const servicoUnico =
        segmentoUnico === "servico" && itensUnicos.length === 1;
      if (alvo) {
        promessas.push(
          salvarSegmentoExistente(alvo.id, segmentoUnico, itensUnicos, {
            linhasEtapas: servicoUnico
              ? linhasEtapasItemControle(itensUnicos[0])
              : undefined,
            tipoProtese: servicoUnico
              ? tituloTrabalhoServicoItem(itensUnicos[0])
              : undefined,
            dentes:
              servicoUnico && itensUnicos[0].numeroDente !== "-"
                ? itensUnicos[0].numeroDente
                : undefined,
          })
        );
      }
    }

    const respostas = await Promise.all(promessas);
    const falha = respostas.find((res) => !res.ok);
    if (falha) {
      alert("Não foi possível salvar a OS. Verifique os dados e tente novamente.");
      return;
    }

    await persistirEtapaAtualEdicaoOs();
    notificarTrabalhosAtualizados({ trabalhoId: editando.id });
    fecharEdicaoOs();
    void load();
    } finally {
      setSalvandoEdicao(false);
    }
  }

  function adicionarLinhaProdutoEdicao() {
    setProdutosOs((atuais) => [...atuais, produtoOsVazio()]);
  }

  function removerItemEdicao(id: string) {
    if (osFaturada) return;
    setEditItems((atuais) => atuais.filter((item) => item.id !== id));
    if (itemSelecionadoId === id) {
      limparSelecaoItemEdicao();
    }
  }

  async function atualizarStatus(trabalho: Trabalho, novoStatus: string) {
    setTrabalhos((atuais) =>
      atuais.map((item) =>
        item.id === trabalho.id ? { ...item, status: novoStatus } : item
      )
    );

    const res = await fetch(`/api/trabalhos/${trabalho.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: novoStatus }),
    });

    if (!res.ok) {
      load();
    } else {
      notificarTrabalhosAtualizados({ trabalhoId: trabalho.id });
    }
  }

  function abrirStatusRapido(trabalho: Trabalho) {
    setStatusEditando(trabalho);
    setStatusForm({
      status: trabalho.status,
      dataPrevista: dateToInput(trabalho.dataPrevista),
      observacoes: trabalho.observacoes || "",
      instrucoes: trabalho.instrucoes || "",
    });
  }

  async function salvarStatusRapido() {
    if (!statusEditando) return;

    setTrabalhos((atuais) =>
      atuais.map((item) =>
        item.id === statusEditando.id
          ? {
              ...item,
              status: statusForm.status,
              dataPrevista: statusForm.dataPrevista || null,
              observacoes: statusForm.observacoes,
              instrucoes: statusForm.instrucoes,
            }
          : item
      )
    );

    const res = await fetch(`/api/trabalhos/${statusEditando.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: statusForm.status,
        dataPrevista: statusForm.dataPrevista || null,
        observacoes: statusForm.observacoes,
        instrucoes: statusForm.instrucoes,
      }),
    });

    setStatusEditando(null);
    if (!res.ok) {
      load();
    } else {
      notificarTrabalhosAtualizados({ trabalhoId: statusEditando.id });
    }
  }

  async function confirmarExclusaoOs() {
    const trabalho = osExcluindo;
    if (!trabalho) return;
    if (trabalhoGrupoFaturado(trabalho)) {
      window.alert(MENSAGEM_OS_FATURADA_NAO_EXCLUI);
      setOsExcluindo(null);
      return;
    }
    const id = trabalho.id;
    setOsExcluindo(null);
    setTrabalhos((lista) => lista.filter((item) => item.id !== id));
    try {
      const res = await fetch(`/api/trabalhos/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(
          typeof data.error === "string" ? data.error : MENSAGEM_OS_FATURADA_NAO_EXCLUI
        );
        void load();
        return;
      }
      void load();
    } catch {
      window.alert("Não foi possível excluir a ordem de serviço.");
      void load();
    }
  }

  return (
    <div className="space-y-3 text-[11px] text-slate-700">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span>Produção</span>
        <span>/</span>
        <span className="font-medium text-slate-700">Controle de Produção</span>
      </div>

      <div className="rounded border border-slate-200 bg-white p-3 shadow-sm">
        <ControleProducaoToolbar viewAtiva="lista" somenteNavegacao />

        <div className="grid gap-2 md:grid-cols-[1fr_1.2fr_1fr_1.2fr_auto]">
          <div>
            <Select label="Situação" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="todos">Todos</option>
              {Object.entries(STATUS_TRABALHO).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.label}
                </option>
              ))}
            </Select>
            <ControleProducaoFiltrosLista
              produtos={filtroProdutos}
              fichasSemServicos={filtroFichasSemServicos}
              onProdutosChange={(valor) => {
                setFiltroProdutos(valor);
                listagem.atualizarExtraRascunho("mostrarProdutosTransportes", valor);
              }}
              onFichasSemServicosChange={setFiltroFichasSemServicos}
              configLista={
                <ConfiguracaoListaGear
                  variante="controle"
                  aberto={listagem.configAberto}
                  onToggle={() => {
                    if (listagem.configAberto) {
                      listagem.fecharConfig();
                      return;
                    }
                    listagem.atualizarRascunho({
                      extras: { mostrarProdutosTransportes: filtroProdutos },
                    });
                    listagem.abrirConfig();
                  }}
                  onFechar={listagem.fecharConfig}
                  rascunho={listagem.rascunho}
                  opcoesOrdenacao={OPCOES_ORDENACAO_CONTROLE}
                  onAlterarOrdenarPor={(valor) => listagem.atualizarRascunho({ ordenarPor: valor })}
                  onAlterarDirecao={(direcao) => listagem.atualizarRascunho({ direcao })}
                  onAlterarPorPagina={(porPagina) => listagem.atualizarRascunho({ porPagina })}
                  extras={[
                    {
                      chave: "mostrarProdutosTransportes",
                      label: "Mostrar Produtos e Transportes",
                    },
                  ]}
                  onAlterarExtra={(chave, valor) => {
                    listagem.atualizarExtraRascunho(chave, valor);
                    if (chave === "mostrarProdutosTransportes") setFiltroProdutos(valor);
                  }}
                  onGravar={() => {
                    const mostrar =
                      listagem.rascunho.extras?.mostrarProdutosTransportes ?? filtroProdutos;
                    setFiltroProdutos(mostrar);
                    if (typeof window !== "undefined") {
                      writeStorage("labProteseControleProdutos", mostrar ? "1" : "0");
                    }
                    listagem.gravarConfig();
                  }}
                />
              }
            />
          </div>
          <CampoDataBr
            label="Data lançamento"
            value={dataEntrada}
            onChange={setDataEntrada}
            placeholder="dd/mm/aaaa"
          />
          <SelectPesquisavel
            label="Cliente"
            value={cliente}
            onChange={setCliente}
            placeholder="Todos"
            options={[
              { value: "", label: "Todos" },
              ...clientes.map((nome) => ({ value: nome, label: nome })),
            ]}
          />
          <Input
            label="Buscar"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nº OS, ID, cliente, paciente ou serviço"
          />
          <Button className="mt-6" size="sm" onClick={load}>
            <Search className="h-4 w-4" />
            Buscar
          </Button>
        </div>
      </div>

      <BarraConfigListagem
        ocultarGear
        pagina={listagem.pagina}
        totalPaginas={listagem.totalPaginas}
        onPagina={listagem.setPagina}
        totalItens={listagem.totalItens}
        configAberto={false}
        onToggleConfig={() => undefined}
        onFecharConfig={() => undefined}
        rascunho={listagem.rascunho}
        opcoesOrdenacao={OPCOES_ORDENACAO_CONTROLE}
        onAlterarOrdenarPor={() => undefined}
        onAlterarDirecao={() => undefined}
        onAlterarPorPagina={() => undefined}
        onGravarConfig={() => undefined}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-[11px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="px-2 py-2 text-left font-semibold uppercase">OS</th>
                <th className="px-2 py-2 text-left font-semibold uppercase">Caixa</th>
                <th className="px-2 py-2 text-left font-semibold uppercase">Entrada</th>
                <th className="px-2 py-2 text-left font-semibold uppercase">Qtd</th>
                <th className="px-2 py-2 text-left font-semibold uppercase">Serviço</th>
                <th className="px-2 py-2 text-left font-semibold uppercase">Cliente</th>
                <th className="px-2 py-2 text-left font-semibold uppercase">Dentista</th>
                <th className="px-2 py-2 text-left font-semibold uppercase">Paciente</th>
                <th className="px-2 py-2 text-left font-semibold uppercase">Colaborador</th>
                <th className="px-2 py-2 text-left font-semibold uppercase">Etapas</th>
                <th className="px-2 py-2 text-left font-semibold uppercase">Situação</th>
                <th className="px-2 py-2 text-center font-semibold uppercase">Opções</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listagem.itensPagina.map((trabalho) => {
                const primeiroItem = parseItens(trabalho)[0];
                const exibicaoLinha = situacaoExibicaoTrabalho(trabalho, primeiroItem);
                const linhaProdutoOuTransporte =
                  exibicaoLinha.kind === "produto" || exibicaoLinha.kind === "transporte";
                const grupoOs = gruposPorNumeroOs.get(trabalho.numeroOs) ?? [trabalho];
                const contextoEtapas = contextoEtapasModuloOsGrupo(
                  grupoOs.map((registro) => ({
                    id: registro.id,
                    numeroOs: registro.numeroOs,
                    tipoProtese: registro.tipoProtese,
                    valor: registro.valor ?? 0,
                    status: registro.status,
                    instrucoes: registro.instrucoes,
                    dataEntrada: registro.dataEntrada,
                    dataPrevista: registro.dataPrevista,
                    segmentoFaturamento: registro.segmentoFaturamento,
                  }))
                );
                const complementosOs = parseComplementosInstrucoesGrupo(
                  grupoOs.map((registro) => registro.instrucoes || "")
                );
                const etapasOs = linhaProdutoOuTransporte ? [] : contextoEtapas.etapas;
                const colaboradoresOs = colaboradoresParaExibicaoControle(
                  complementosOs.colaboradores,
                  etapasOs
                );
                const resumoColaborador = resumoColaboradorControle(colaboradoresOs);
                return (
                <Fragment key={trabalho.id}>
                  <tr className="hover:bg-slate-50">
                    <td className="px-2 py-2">{osBadge(trabalho.numeroOs)}</td>
                    <td className="px-2 py-2">{caixaOs(trabalho)}</td>
                    <td className="px-2 py-2">{formatDate(trabalho.dataEntrada)}</td>
                    <td className="px-2 py-2">{primeiroItem?.quantidade || "1"}</td>
                    <td className="px-2 py-2">
                      <ServicoComMarcadores item={primeiroItem || {
                        id: `${trabalho.id}-principal`,
                        servico: trabalho.tipoProtese,
                        numeroDente: trabalho.dentes || "",
                        corDente: trabalho.cor || "",
                        quantidade: "1",
                        valor: trabalho.valor || 0,
                      }} />
                    </td>
                    <td className="px-2 py-2">{clienteNome(trabalho)}</td>
                    <td className="px-2 py-2">{exibirTexto(trabalho.cliente?.cro)}</td>
                    <td className="px-2 py-2">{pacienteNome(trabalho)}</td>
                    <td
                      className="max-w-[160px] truncate px-2 py-2"
                      title={
                        resumoColaborador
                          ? "Colaboradores da ordem de serviço (edite pelo ícone de lápis)"
                          : undefined
                      }
                    >
                      {resumoColaborador}
                    </td>
                    <td
                      className="max-w-[200px] px-2 py-2 align-top"
                      title={
                        etapasOs.length
                          ? "Etapas da ordem de serviço (edite pelo ícone de lápis)"
                          : undefined
                      }
                    >
                      <EtapasControleCelula
                        etapas={etapasOs}
                        trabalhoId={contextoEtapas.trabalhoId}
                        itemId={contextoEtapas.itemId}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <CelulaSituacaoControle
                        trabalho={trabalho}
                        primeiroItem={primeiroItem}
                        onEditarStatus={() => abrirStatusRapido(trabalho)}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex justify-center gap-1 text-slate-500">
                        <button
                          type="button"
                          onClick={() => setOsAberta(osAberta === trabalho.id ? null : trabalho.id)}
                          title="Ver detalhes"
                          className="rounded p-1 hover:bg-slate-100 hover:text-primary-700"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => abrirEdicao(trabalho)}
                          title="Editar OS"
                          className="rounded p-1 hover:bg-slate-100 hover:text-primary-700"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setImprimirOs(trabalho)}
                          title="Imprimir OS"
                          className="rounded p-1 hover:bg-slate-100 hover:text-primary-700"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (trabalhoGrupoFaturado(trabalho)) {
                              window.alert(MENSAGEM_OS_FATURADA_NAO_EXCLUI);
                              return;
                            }
                            setOsExcluindo(trabalho);
                          }}
                          title="Excluir OS"
                          className="rounded p-1 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {osAberta === trabalho.id && (
                    <tr>
                      <td colSpan={12} className="bg-slate-50 px-4 py-3">
                        {(() => {
                          const anexos = anexosFromInstrucoes(trabalho.instrucoes);
                          return anexos.length > 0 ? (
                            <div className="mb-3">
                              <p className="mb-2 text-xs font-semibold text-slate-600">Imagem:</p>
                              <div className="flex flex-wrap gap-2">
                                {anexos.map((anexo) => (
                                  <button
                                    type="button"
                                    key={`${anexo.url}-${anexo.name}`}
                                    onClick={() => setAnexoAberto(anexo)}
                                    className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm hover:border-primary-300"
                                    title={anexo.name}
                                  >
                                    {anexo.type.startsWith("image/") ? (
                                      <img src={anexo.url} alt={anexo.name} className="h-16 w-24 object-cover" />
                                    ) : anexo.type.startsWith("video/") ? (
                                      <video src={anexo.url} className="h-16 w-24 bg-black object-cover" />
                                    ) : (
                                      <div className="flex h-16 w-24 items-center justify-center text-[10px] text-slate-400">Arquivo</div>
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null;
                        })()}
                        <div className="grid gap-3 md:grid-cols-4">
                          <Detail label="OS Externa" value="-" />
                          <Detail label="Prazo Laboratório" value={formatDate(trabalho.dataPrevista)} />
                          <Detail label="Valor Unitário" value={formatCurrency(trabalho.valor)} />
                          <Detail label="Número do Dente" value={exibirTexto(trabalho.dentes)} />
                          <Detail label="Cor do Dente" value={exibirTexto(trabalho.cor)} />
                          <Detail label="Material enviado" value={trabalho.material || ""} />
                          <Detail label="Observação Serviço" value={trabalho.observacoes || ""} emptyValue="" />
                          <Detail label="Observação Interna / Técnica" value={instrucoesSemAnexos(trabalho.instrucoes)} />
                        </div>
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            onClick={() => setImprimirOs(trabalho)}
                          >
                            Ver Protocolo
                          </Button>
                          <button className="rounded border border-emerald-300 px-3 py-1 text-emerald-700">
                            + Adicionar Imagem
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
                );
              })}
              {listagem.totalItens === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-slate-400">
                    Nenhuma OS encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </BarraConfigListagem>

      <ConfirmacaoExclusaoModal
        open={!!osExcluindo}
        titulo="Excluir Ordem de Serviço"
        mensagem="Deseja realmente excluir essa Ordem de Serviço?"
        aviso="Atenção!! Todas as comissões serão excluídas exceto comissões já faturadas. Se a OS já foi faturada em Contas a Receber, exclua o lançamento no Financeiro antes."
        onClose={() => setOsExcluindo(null)}
        onConfirm={confirmarExclusaoOs}
      />

      {anexoAberto && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-slate-700">{anexoAberto.name}</h2>
                <p className="text-xs text-slate-400">{anexoAberto.type || "Arquivo anexado"}</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={anexoAberto.url}
                  download={anexoAberto.name}
                  className="rounded border border-primary-200 px-3 py-2 text-xs font-medium text-primary-700 hover:bg-primary-50"
                >
                  Baixar
                </a>
                <button
                  type="button"
                  onClick={() => setAnexoAberto(null)}
                  className="rounded border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Fechar
                </button>
              </div>
            </div>
            <div className="flex flex-1 items-center justify-center overflow-auto bg-slate-950 p-4">
              {anexoAberto.type.startsWith("image/") ? (
                <img
                  src={anexoAberto.url}
                  alt={anexoAberto.name}
                  className="max-h-[78vh] max-w-full rounded bg-white object-contain"
                />
              ) : anexoAberto.type.startsWith("video/") ? (
                <video
                  src={anexoAberto.url}
                  controls
                  autoPlay
                  className="max-h-[78vh] max-w-full rounded bg-black"
                />
              ) : (
                <div className="rounded bg-white p-8 text-center text-slate-500">
                  <p>Pré-visualização indisponível para este arquivo.</p>
                  <a href={anexoAberto.url} download={anexoAberto.name} className="mt-3 inline-block text-primary-700">
                    Baixar arquivo
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {statusEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded bg-white p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-sm font-semibold text-slate-700">Alteração Rápida</h2>
              <button
                type="button"
                onClick={() => setStatusEditando(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                x
              </button>
            </div>

            <div className="space-y-3">
              <Select
                label="Situação"
                value={statusForm.status}
                onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
              >
                {Object.entries(STATUS_TRABALHO).map(([key, value]) => (
                  <option key={key} value={key}>{value.label}</option>
                ))}
              </Select>

              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  label="Protocolo"
                  value={String(statusEditando.numeroOs)}
                  readOnly
                />
                <Input
                  label="Data Disponibilidade"
                  type="date"
                  value={statusForm.dataPrevista}
                  onChange={(e) => setStatusForm({ ...statusForm, dataPrevista: e.target.value })}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  label="Prazo Laboratório"
                  type="date"
                  value={statusForm.dataPrevista}
                  onChange={(e) => setStatusForm({ ...statusForm, dataPrevista: e.target.value })}
                />
                <Input label="Hora Laboratório" type="time" />
              </div>

              <Textarea
                label="Observações Internas / Técnicas"
                value={statusForm.instrucoes}
                onChange={(e) => setStatusForm({ ...statusForm, instrucoes: e.target.value })}
              />
              <Textarea
                label="Observações Serviço"
                value={statusForm.observacoes}
                onChange={(e) => setStatusForm({ ...statusForm, observacoes: e.target.value })}
              />

              <div className="space-y-2 pt-2">
                <Button className="w-full" onClick={salvarStatusRapido}>
                  Gravar
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setStatusEditando(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editando && form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 md:p-4">
          <div className="flex max-h-[94vh] w-full max-w-[96vw] flex-col overflow-hidden rounded border border-slate-200 bg-white shadow-xl">
            <div className="relative shrink-0 border-b border-slate-100 px-4 py-3">
              <p className="text-left text-xs font-medium text-slate-500">Editar Entrada</p>
              <h2 className="text-center text-sm font-medium text-slate-700">
                Ordem de Serviço {editando.numeroOs}
              </h2>
              <button
                type="button"
                onClick={fecharEdicaoOs}
                className="absolute right-4 top-3 text-lg text-slate-400 hover:text-slate-700"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto text-xs text-slate-700">
              <section className="grid gap-3 p-4 md:grid-cols-4">
                <Input label="Data Lançamento Ficha" value={formatDate(editando.dataEntrada)} readOnly />
                <Input label="OS Externa" value="" readOnly />
                <Input label="Caixa Organizadora" value={caixaOs(editando)} readOnly />
                <Input label="Paciente" value={pacienteNome(editando)} readOnly />
                <Input label="Selecione um Cliente *" value={clienteNome(editando)} readOnly />
                <Input label="Dentista Conveniado" value="" readOnly />
                <div className="md:col-span-2">
                  <Input
                    label="Material Enviado pelo Dentista"
                    value={exibirTexto(form.material)}
                    readOnly
                  />
                </div>
                <div className="md:col-span-4">
                  <TextareaObservacaoInterna
                    label="Observação Interna"
                    value={form.observacoes}
                    onChange={(observacoes) => setForm({ ...form, observacoes })}
                  />
                </div>
                <p className="md:col-span-4 text-xs text-primary-600">
                  Tabela Utilizada: Tabela Principal
                </p>
              </section>

              <section
                className={cn(
                  "border-t border-slate-100 bg-slate-50/50 p-4",
                  osFaturada && "relative"
                )}
              >
                {osFaturada && (
                  <div className="mb-3 rounded-sm border border-red-200 bg-red-50 px-3 py-2.5 text-[11px] leading-relaxed text-red-800">
                    <span className="mr-2 inline-flex rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                      Faturado
                    </span>
                    Esta ordem de serviço já foi faturada em{" "}
                    <strong>Contas a Receber</strong>. Os serviços estão bloqueados para edição,
                    mas você ainda pode alterar <strong>observação interna</strong> e{" "}
                    <strong>comissões</strong> (colaboradores e terceirizados).
                  </div>
                )}
                <div
                  className={cn(
                    "rounded border border-slate-200 bg-white p-3",
                    osFaturada && "pointer-events-none select-none opacity-55"
                  )}
                >
                  <p className="mb-3 text-center text-sm font-medium text-slate-600">
                    Serviços/Produtos Adicionados
                  </p>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={abrirAdicionarServico}
                      disabled={osFaturada}
                      className="inline-flex items-center gap-1 rounded border border-primary-400 bg-white px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar Serviço
                    </button>
                    <span className="text-[11px] text-slate-600">
                      Total Serviços: {formatCurrency(totalItensEdicao)}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                          <th className="px-3 py-2 text-left font-semibold uppercase">Selecionado</th>
                          <th className="px-3 py-2 text-left font-semibold uppercase">Serviço/Produto</th>
                          <th className="px-3 py-2 text-left font-semibold uppercase">Número Dente</th>
                          <th className="px-3 py-2 text-left font-semibold uppercase">Cor Dente</th>
                          <th className="px-3 py-2 text-left font-semibold uppercase">Quantidade</th>
                          <th className="px-3 py-2 text-left font-semibold uppercase">Valor</th>
                          <th className="px-3 py-2 text-center font-semibold uppercase">Opções</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {editItems.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-3 py-5 text-center text-slate-400">
                              Nenhum serviço adicionado. Clique em Adicionar Serviço ou selecione uma linha.
                            </td>
                          </tr>
                        )}
                        {editItems.map((item) => (
                          <tr
                            key={item.id}
                            onClick={() => selecionarItemEdicao(item)}
                            className={`cursor-pointer transition-colors hover:bg-slate-50 ${
                              itemSelecionadoId === item.id ? "bg-[#FFE5D4]" : ""
                            }`}
                          >
                            <td className="px-3 py-2 text-center">
                              {itemSelecionadoId === item.id ? (
                                <span className="text-sm font-semibold text-slate-600">✓</span>
                              ) : null}
                            </td>
                            <td className="px-3 py-2 text-slate-700">
                              <ServicoComMarcadores item={item} />
                            </td>
                            <td className="px-3 py-2 text-slate-600">
                              {itemUsaCamposOdontologicos(item)
                                ? exibirTexto(item.numeroDente)
                                : ""}
                            </td>
                            <td className="px-3 py-2 text-slate-600">
                              {itemUsaCamposOdontologicos(item) ? exibirTexto(item.corDente) : ""}
                            </td>
                            <td className="px-3 py-2 text-slate-600">{item.quantidade}</td>
                            <td className="px-3 py-2 text-slate-700">{formatCurrency(item.valor)}</td>
                            <td className="px-3 py-2 text-center">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  removerItemEdicao(item.id);
                                }}
                                className="rounded p-1 text-red-500 hover:bg-red-50"
                                title="Excluir serviço"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              {painelEdicaoVisivel && (
              <section className="border-t border-slate-100 bg-slate-50/50 p-4">
                <div className="rounded border border-slate-200 bg-white p-4">
                  {(painelEdicaoItem === "servico" || adicionandoServico) && (
                    <>
                    <div
                      className={cn(
                        osFaturada &&
                          abaServicoEdicao !== "colaboradores" &&
                          abaServicoEdicao !== "terceiros" &&
                          "pointer-events-none select-none opacity-55"
                      )}
                    >
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                      <span className="text-[11px] text-slate-500">
                        Data Lançamento:{" "}
                        <span className="font-medium text-slate-700">
                          {formatDate(editando.dataEntrada)}
                        </span>
                      </span>
                      {osFaturada && (
                        <span className="rounded bg-red-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                          Faturado
                        </span>
                      )}
                    </div>
                    <h3 className="mb-4 text-center text-base font-medium text-slate-700">Serviço</h3>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex gap-5">
                        <label className="flex cursor-pointer flex-col items-start gap-1 text-[10px] font-medium text-slate-500">
                          <span>Urgente</span>
                          <span
                            className={`relative inline-flex h-5 w-10 items-center rounded-full transition ${
                              form.urgente ? "bg-red-700" : "bg-slate-200"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={form.urgente}
                              onChange={(e) => setForm({ ...form, urgente: e.target.checked })}
                              className="peer sr-only"
                            />
                            <span
                              className={`absolute left-1 h-4 w-4 rounded-full bg-white shadow transition ${
                                form.urgente ? "translate-x-5" : ""
                              }`}
                            />
                          </span>
                        </label>
                        <label className="flex cursor-pointer flex-col items-start gap-1 text-[10px] font-medium text-slate-500">
                          <span>Repetição</span>
                          <span
                            className={`relative inline-flex h-5 w-10 items-center rounded-full transition ${
                              form.repeticao ? "bg-orange-300" : "bg-slate-200"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={form.repeticao}
                              onChange={(e) => setForm({ ...form, repeticao: e.target.checked })}
                              className="peer sr-only"
                            />
                            <span
                              className={`absolute left-1 h-4 w-4 rounded-full bg-white shadow transition ${
                                form.repeticao ? "translate-x-5" : ""
                              }`}
                            />
                          </span>
                        </label>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-primary-700">
                        <span>Total Serviço:</span>
                        <input
                          className="w-40 rounded border border-slate-200 px-3 py-2 text-right text-slate-700"
                          value={formatCurrency(totalServicoEdicao)}
                          readOnly
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-6">
                      <Select
                        label="Categoria"
                        value={form.categoria}
                        onChange={(e) => selecionarCategoriaServicoEdicao(e.target.value)}
                        disabled={categoriasTabelaPreco.length === 0}
                      >
                        <option value="">
                          {categoriasTabelaPreco.length === 0
                            ? "Cadastre categorias na Tabela de Preços"
                            : "Selecione uma Categoria"}
                        </option>
                        {categoriasSelecionaveisNaOs(categoriasTabelaPreco).map((categoria) => (
                          <option key={categoria.id} value={categoria.nome}>
                            {categoria.nome}
                          </option>
                        ))}
                        {form.categoria &&
                          !categoriasTabelaPreco.some((c) => c.nome === form.categoria) && (
                            <option value={form.categoria}>{form.categoria}</option>
                          )}
                      </Select>
                      <Select
                        label="Serviço"
                        value={valorSelectServicoEdicao()}
                        onChange={(e) => selecionarServicoTabelaEdicao(e.target.value)}
                        disabled={!form.categoria}
                      >
                        <option value="">
                          {!form.categoria
                            ? "Selecione uma categoria"
                            : servicosDaCategoriaEdicao.length === 0
                              ? "Nenhum serviço nesta categoria"
                              : "Selecione um Serviço"}
                        </option>
                        {valorSelectServicoEdicao() &&
                          !servicosDaCategoriaEdicao.some(
                            (s) => s.nome === valorSelectServicoEdicao()
                          ) && (
                            <option value={valorSelectServicoEdicao()}>
                              {valorSelectServicoEdicao()}
                            </option>
                          )}
                        {servicosDaCategoriaEdicao.map((servico) => (
                          <option key={servico.id} value={servico.nome}>
                            {servico.nome}
                            {servico.tipo === "transporte" ? " (Transporte)" : ""}
                          </option>
                        ))}
                      </Select>
                      <Input
                        label="Qtd"
                        type="number"
                        min="1"
                        value={form.quantidade}
                        onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
                      />
                      <Input
                        label="Valor Un."
                        selectOnFocus
                        value={form.valor}
                        onChange={(e) =>
                          setForm({ ...form, valor: formatCurrencyInputControle(e.target.value) })
                        }
                      />
                      <div className="space-y-1">
                        <label className="block text-sm font-medium text-slate-700">Desc.</label>
                        <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20">
                          <select
                            value={form.descontoTipo}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                descontoTipo: e.target.value,
                                desconto: e.target.value === "valor" ? "R$ 0,00" : "0,00",
                              })
                            }
                            className="w-14 border-r border-slate-300 bg-white px-2 text-sm text-slate-600 focus:outline-none"
                          >
                            <option value="percentual">%</option>
                            <option value="valor">$</option>
                          </select>
                          <input
                            value={form.desconto}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                desconto:
                                  form.descontoTipo === "valor"
                                    ? formatCurrencyInputControle(e.target.value)
                                    : formatPercentInputControle(e.target.value),
                              })
                            }
                            placeholder={form.descontoTipo === "valor" ? "R$ 0,00" : "0,00"}
                            className="w-full px-3 py-2 text-sm outline-none"
                            {...propsInputComSelecaoAoFocar({})}
                          />
                        </div>
                      </div>
                      <Select
                        label="Situação"
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                      >
                        {Object.entries(STATUS_TRABALHO).map(([key, value]) => (
                          <option key={key} value={key}>
                            {value.label}
                          </option>
                        ))}
                      </Select>
                      <CampoDataBr
                        label="Prazo Laboratório"
                        value={form.dataLaboratorio}
                        onChange={(value) =>
                          setForm({
                            ...form,
                            dataLaboratorio: value,
                            dataPrevista: brShortToIso(value) || form.dataPrevista,
                          })
                        }
                      />
                      <Input
                        label="Hora Laboratório"
                        type="time"
                        value={form.horaLaboratorio}
                        onChange={(e) => setForm({ ...form, horaLaboratorio: e.target.value })}
                      />
                      <CampoDataBr
                        label="Prazo Dentista"
                        value={form.dataDentista}
                        onChange={(value) => setForm({ ...form, dataDentista: value })}
                      />
                      <Input
                        label="Hora Dentista"
                        type="time"
                        value={form.horaDentista}
                        onChange={(e) => setForm({ ...form, horaDentista: e.target.value })}
                      />
                      <Input
                        label="Escala/Cor"
                        value={form.escalaCor}
                        onChange={(e) =>
                          setForm({ ...form, escalaCor: e.target.value, cor: e.target.value })
                        }
                      />
                    </div>

                    <div className="mt-5 text-center">
                      <div className="mb-2 text-[11px] text-slate-500">Selecione os dentes do trabalho</div>
                      <div className="mb-3 flex justify-center gap-5 text-[11px] text-slate-600">
                        <label className="inline-flex cursor-pointer items-center gap-1.5">
                          <input
                            type="radio"
                            name="tipoDenticaoControle"
                            checked={tipoDenticao === "permanente"}
                            onChange={() => trocarTipoDenticaoEdicao("permanente")}
                            className="h-3.5 w-3.5 accent-blue-500"
                          />
                          Permanente
                        </label>
                        <label className="inline-flex cursor-pointer items-center gap-1.5">
                          <input
                            type="radio"
                            name="tipoDenticaoControle"
                            checked={tipoDenticao === "deciduos"}
                            onChange={() => trocarTipoDenticaoEdicao("deciduos")}
                            className="h-3.5 w-3.5 accent-blue-500"
                          />
                          Decíduos
                        </label>
                      </div>
                      <div className="mx-auto max-w-3xl rounded bg-white px-3 py-2">
                        <div className="flex items-end justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => selecionarArcadaEdicao("sup")}
                            className="mb-1 rounded bg-slate-500 px-2 py-1 text-[11px] font-bold text-white hover:bg-primary-600"
                          >
                            SUP
                          </button>
                          <div className="flex flex-wrap justify-center gap-0.5 border-b border-dashed border-slate-300 pb-1">
                            {dentesPorDenticaoControle(tipoDenticao).superiores.map((dente) => {
                              const selected = dentesEdicao.includes(dente);
                              const imagemDente = urlImagemDente(dente, tipoDenticao);
                              return (
                                <button
                                  key={dente}
                                  type="button"
                                  onClick={() => toggleDenteEdicao(dente)}
                                  className={`group flex w-7 flex-col items-center gap-0.5 rounded px-0.5 py-1 transition ${
                                    selected
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "text-slate-500 hover:bg-slate-50"
                                  }`}
                                >
                                  <img
                                    src={imagemDente}
                                    alt={`Dente ${dente}`}
                                    className={`h-8 w-5 object-contain transition ${
                                      selected
                                        ? "opacity-100 drop-shadow-[0_0_7px_rgba(16,185,129,0.85)] sepia saturate-200 hue-rotate-75"
                                        : "opacity-45 grayscale group-hover:opacity-80"
                                    }`}
                                    onError={(event) => {
                                      event.currentTarget.style.display = "none";
                                    }}
                                  />
                                  <span
                                    className={`text-[11px] leading-none ${
                                      selected ? "font-bold text-emerald-600" : "text-slate-500"
                                    }`}
                                  >
                                    {dente}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex items-start justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => selecionarArcadaEdicao("inf")}
                            className="mt-1 rounded bg-slate-500 px-2 py-1 text-[11px] font-bold text-white hover:bg-primary-600"
                          >
                            INF
                          </button>
                          <div className="flex flex-wrap justify-center gap-0.5 pt-1">
                            {dentesPorDenticaoControle(tipoDenticao).inferiores.map((dente) => {
                              const selected = dentesEdicao.includes(dente);
                              const imagemDente = urlImagemDente(dente, tipoDenticao);
                              return (
                                <button
                                  key={dente}
                                  type="button"
                                  onClick={() => toggleDenteEdicao(dente)}
                                  className={`group flex w-7 flex-col items-center gap-0.5 rounded px-0.5 py-1 transition ${
                                    selected
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "text-slate-500 hover:bg-slate-50"
                                  }`}
                                >
                                  <img
                                    src={imagemDente}
                                    alt={`Dente ${dente}`}
                                    className={`order-2 h-8 w-5 object-contain transition ${
                                      selected
                                        ? "opacity-100 drop-shadow-[0_0_7px_rgba(16,185,129,0.85)] sepia saturate-200 hue-rotate-75"
                                        : "opacity-45 grayscale group-hover:opacity-80"
                                    }`}
                                    onError={(event) => {
                                      event.currentTarget.style.display = "none";
                                    }}
                                  />
                                  <span
                                    className={`text-[11px] leading-none ${
                                      selected ? "font-bold text-emerald-600" : "text-slate-500"
                                    }`}
                                  >
                                    {dente}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="mb-3 text-left text-[11px] font-semibold text-emerald-600">
                        Dentes Selecionados: {renderDentesSelecionadosControle(form.dentes)}
                      </div>
                      <div className="mb-5">
                        <Textarea
                          label="Observação Serviço"
                          value={form.observacaoServico}
                          onChange={(e) =>
                            setForm({ ...form, observacaoServico: e.target.value })
                          }
                          placeholder="Descreva todos os detalhes do trabalho, ajustes, material, cor, acabamento, prova, entrega..."
                          className="min-h-16"
                        />
                      </div>
                    </div>
                    </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPainelEdicaoItem("servico");
                            setAbaServicoEdicao("etapas");
                          }}
                          className={classeAbaEdicao("etapas")}
                        >
                          Etapas
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAbaServicoEdicao("produtos");
                            if (produtosOs.length === 0) {
                              setProdutosOs([
                                produtoOsVazio(),
                              ]);
                            }
                          }}
                          className={classeAbaEdicao("produtos")}
                        >
                          {abaServicoEdicao === "produtos" ? "Produtos" : "PRODUTOS"}
                        </button>
                        <button
                          type="button"
                          onClick={() => abrirAbaComissoesEdicao("colaboradores")}
                          className={classeAbaEdicao("colaboradores")}
                        >
                          Colaboradores / Comissões
                        </button>
                        <button
                          type="button"
                          onClick={() => abrirAbaComissoesEdicao("terceiros")}
                          className={classeAbaEdicao("terceiros")}
                        >
                          Serviços Terceirizados / Comissões
                        </button>
                      </div>
                      <div
                        className={cn(
                          "mt-3 rounded border border-slate-200 p-3 text-left",
                          abaServicoEdicao === "etapas" ? "bg-white" : "bg-slate-50",
                          osFaturada &&
                            abaServicoEdicao !== "colaboradores" &&
                            abaServicoEdicao !== "terceiros" &&
                            "pointer-events-none select-none opacity-55"
                        )}
                      >
                        {abaServicoEdicao === "etapas" && (
                          <EtapasOsEditor
                            etapas={etapasEdicao}
                            onChange={setEtapasEdicao}
                            quantidadeDentes={dentesEdicao.length || 1}
                            dataLancamento={editando ? formatDate(editando.dataEntrada) : ""}
                            horaLaboratorio={form?.horaLaboratorio || ""}
                            desabilitado={osFaturada}
                            servico={servicoOsAtualEdicao}
                            repeticao={Boolean(form?.repeticao)}
                            indiceEtapaAtual={indiceEtapaAtualEdicao}
                            onIndiceEtapaAtualChange={setIndiceEtapaAtualEdicao}
                          />
                        )}
                        {abaServicoEdicao === "produtos" && (
                          <div className="space-y-3">
                            <span className="text-sm font-semibold text-slate-800">Produtos</span>
                            {produtosOs.length === 0 && (
                              <button
                                type="button"
                                onClick={adicionarLinhaProdutoEdicao}
                                className="w-full rounded bg-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary-700"
                              >
                                + Adicionar Produto
                              </button>
                            )}
                            {produtosOs.map((produtoOs, index) => (
                              <div
                                key={`${produtoOs.produtoId}-${index}`}
                                className="grid gap-3 rounded border border-slate-200 bg-white p-3 md:grid-cols-[1.4fr_0.7fr_1fr_1fr_auto]"
                              >
                                <Select
                                  label="Produto cadastrado"
                                  value={produtoOs.produtoId}
                                  onChange={(e) => {
                                    const produto = produtosCadastro.find(
                                      (item) => item.id === e.target.value
                                    );
                                    setProdutosOs((atuais) =>
                                      atuais.map((item, i) =>
                                        i === index
                                          ? atualizarProdutoOsSelecao(item, produto, e.target.value)
                                          : item
                                      )
                                    );
                                  }}
                                >
                                  <option value="">Selecione um produto</option>
                                  {produtosCadastro.map((produto) => (
                                    <option key={produto.id} value={produto.id}>
                                      {produto.nome} - {formatCurrency(produto.valor)}
                                    </option>
                                  ))}
                                </Select>
                                <Input
                                  label="Quantidade"
                                  type="number"
                                  min="1"
                                  value={produtoOs.quantidade}
                                  onChange={(e) =>
                                    setProdutosOs((atuais) =>
                                      atuais.map((item, i) =>
                                        i === index
                                          ? atualizarProdutoOsQuantidade(item, e.target.value)
                                          : item
                                      )
                                    )
                                  }
                                />
                                <Input
                                  label="Valor"
                                  selectOnFocus
                                  value={produtoOs.valor}
                                  onChange={(e) =>
                                    setProdutosOs((atuais) =>
                                      atuais.map((item, i) =>
                                        i === index
                                          ? atualizarProdutoOsValorTotal(item, e.target.value)
                                          : item
                                      )
                                    )
                                  }
                                />
                                <Input
                                  label="Observação"
                                  value={produtoOs.observacao}
                                  onChange={(e) =>
                                    setProdutosOs((atuais) =>
                                      atuais.map((item, i) =>
                                        i === index ? { ...item, observacao: e.target.value } : item
                                      )
                                    )
                                  }
                                  placeholder="Lote, marca ou detalhe"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setProdutosOs((atuais) => atuais.filter((_, i) => i !== index))
                                  }
                                  className="mt-6 inline-flex h-10 items-center justify-center rounded border border-red-200 px-3 text-red-600 hover:bg-red-50"
                                  title="Excluir produto"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                            {produtosOs.length > 0 && (
                              <button
                                type="button"
                                onClick={adicionarLinhaProdutoEdicao}
                                className="w-full rounded bg-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary-700"
                              >
                                + Adicionar Produto
                              </button>
                            )}
                          </div>
                        )}
                        {abaServicoEdicao === "colaboradores" && (
                          <div className="space-y-3">
                            <span className="text-sm font-semibold text-slate-800">
                              Colaboradores / Comissões
                            </span>
                            {!servicoTemComissoesColaboradoresNaTabela(servicoOsAtualEdicao) ? (
                              <p className="text-[11px] text-slate-500">
                                {servicoOsAtualEdicao
                                  ? `Nenhum colaborador com comissão cadastrado na tabela de preços do serviço ${servicoOsAtualEdicao.nome}.`
                                  : "Selecione um serviço com colaboradores cadastrados na tabela de preços."}
                              </p>
                            ) : (
                              <>
                            <p className="text-[10px] text-slate-500">
                              Colaboradores e comissões cadastrados na tabela de preços do serviço{" "}
                              <span className="font-medium text-slate-700">
                                {servicoOsAtualEdicao?.nome}
                              </span>
                              .
                            </p>
                            {colaboradoresEdicao.length === 0 && (
                              <button
                                type="button"
                                onClick={adicionarLinhaColaboradorEdicao}
                                className="w-full rounded bg-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary-700"
                              >
                                + Adicionar Colaborador
                              </button>
                            )}
                            {colaboradoresEdicao.map((colaborador, index) => (
                              <div
                                key={`${colaborador.nome}-${index}`}
                                className="grid gap-3 rounded border border-slate-200 bg-white p-3 md:grid-cols-[1fr_1fr_1fr_auto]"
                              >
                                {colaboradoresOpcoes.length > 0 ? (
                                  <Select
                                    label="Colaborador"
                                    value={colaborador.nome}
                                    onChange={(e) =>
                                      selecionarColaboradorEdicao(index, e.target.value)
                                    }
                                  >
                                    <option value="">Selecione um colaborador</option>
                                    {colaborador.nome &&
                                      !comissoesColaboradoresServicoEdicao.some(
                                        (c) => c.nome === colaborador.nome
                                      ) &&
                                      !colaboradoresOpcoes.some(
                                        (c) => c.nome === colaborador.nome
                                      ) && (
                                        <option value={colaborador.nome}>{colaborador.nome}</option>
                                      )}
                                    {comissoesColaboradoresServicoEdicao.length > 0
                                      ? comissoesColaboradoresServicoEdicao.map((opcao) => (
                                          <option key={opcao.id || opcao.nome} value={opcao.nome}>
                                            {opcao.nome}
                                          </option>
                                        ))
                                      : colaboradoresOpcoes.map((opcao) => (
                                          <option key={opcao.id} value={opcao.nome}>
                                            {opcao.nome}
                                          </option>
                                        ))}
                                  </Select>
                                ) : (
                                  <Input
                                    label="Colaborador"
                                    value={colaborador.nome}
                                    onChange={(e) =>
                                      selecionarColaboradorEdicao(index, e.target.value)
                                    }
                                    placeholder="Nome do colaborador"
                                  />
                                )}
                                <Input
                                  label="Comissão (%)"
                                  value={colaborador.comissao}
                                  onChange={(e) =>
                                    setColaboradoresEdicao((atuais) =>
                                      atuais.map((item, i) =>
                                        i === index
                                          ? {
                                              ...item,
                                              comissao: formatarComissaoPercentInput(e.target.value),
                                            }
                                          : item
                                      )
                                    )
                                  }
                                  placeholder="0,00%"
                                />
                                {modelosEtapasOs.length > 0 ? (
                                  <Select
                                    label="Etapa"
                                    value={colaborador.etapa}
                                    onChange={(e) =>
                                      setColaboradoresEdicao((atuais) =>
                                        atuais.map((item, i) =>
                                          i === index ? { ...item, etapa: e.target.value } : item
                                        )
                                      )
                                    }
                                  >
                                    <option value="">Selecione uma etapa</option>
                                    {colaborador.etapa &&
                                      !modelosEtapasOs.some((m) => m.nome === colaborador.etapa) && (
                                        <option value={colaborador.etapa}>
                                          {nomeEtapaSemSetor(colaborador.etapa)}
                                        </option>
                                      )}
                                    {modelosEtapasOs.map((modelo) => (
                                      <option key={modelo.id} value={modelo.nome}>
                                        {modelo.nome}
                                      </option>
                                    ))}
                                  </Select>
                                ) : (
                                  <Input
                                    label="Etapa"
                                    value={colaborador.etapa}
                                    onChange={(e) =>
                                      setColaboradoresEdicao((atuais) =>
                                        atuais.map((item, i) =>
                                          i === index ? { ...item, etapa: e.target.value } : item
                                        )
                                      )
                                    }
                                    placeholder="Produção, prova, finalizado..."
                                  />
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setColaboradoresEdicao((atuais) =>
                                      atuais.filter((_, i) => i !== index)
                                    )
                                  }
                                  className="mt-6 inline-flex h-10 items-center justify-center rounded border border-red-200 px-3 text-red-600 hover:bg-red-50"
                                  title="Excluir colaborador"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                            {colaboradoresEdicao.length > 0 && (
                              <button
                                type="button"
                                onClick={adicionarLinhaColaboradorEdicao}
                                className="w-full rounded bg-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary-700"
                              >
                                + Adicionar Colaborador
                              </button>
                            )}
                              </>
                            )}
                          </div>
                        )}
                        {abaServicoEdicao === "terceiros" && (
                          <div className="space-y-3">
                            <span className="text-sm font-semibold text-slate-800">
                              Serviços Terceirizados / Comissões
                            </span>
                            {!servicoTemComissoesTerceirizadosNaTabela(servicoOsAtualEdicao) ? (
                              <p className="text-[11px] text-slate-500">
                                {servicoOsAtualEdicao
                                  ? `Nenhum serviço terceirizado cadastrado na tabela de preços do serviço ${servicoOsAtualEdicao.nome}.`
                                  : "Selecione um serviço com terceirizados cadastrados na tabela de preços."}
                              </p>
                            ) : (
                              <>
                            <p className="text-[10px] text-slate-500">
                              Serviços terceirizados cadastrados na tabela de preços do serviço{" "}
                              <span className="font-medium text-slate-700">
                                {servicoOsAtualEdicao?.nome}
                              </span>
                              .
                            </p>
                            {terceirizadosEdicao.length === 0 && (
                              <button
                                type="button"
                                onClick={adicionarLinhaTerceirizadoEdicao}
                                className="w-full rounded bg-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary-700"
                              >
                                + Adicionar Terceirizado
                              </button>
                            )}
                            {terceirizadosEdicao.map((terceiro, index) => (
                              <div
                                key={`${terceiro.nome}-${index}`}
                                className="grid gap-3 rounded border border-slate-200 bg-white p-3 md:grid-cols-[1fr_1fr_1fr_auto]"
                              >
                                {comissoesTerceirizadosServicoEdicao.length > 0 ||
                                opcoesTerceirizados.length > 0 ? (
                                  <Select
                                    label="Terceirizado"
                                    value={terceiro.nome}
                                    onChange={(e) =>
                                      selecionarTerceirizadoEdicao(index, e.target.value)
                                    }
                                  >
                                    <option value="">Selecione um terceirizado</option>
                                    {terceiro.nome &&
                                      !comissoesTerceirizadosServicoEdicao.some(
                                        (c) => c.nome === terceiro.nome
                                      ) &&
                                      !opcoesTerceirizados.some((c) => c.nome === terceiro.nome) && (
                                        <option value={terceiro.nome}>{terceiro.nome}</option>
                                      )}
                                    {comissoesTerceirizadosServicoEdicao.length > 0
                                      ? comissoesTerceirizadosServicoEdicao.map((opcao) => (
                                          <option key={opcao.id || opcao.nome} value={opcao.nome}>
                                            {opcao.nome}
                                          </option>
                                        ))
                                      : opcoesTerceirizados.map((opcao) => (
                                          <option key={opcao.id} value={opcao.nome}>
                                            {opcao.nome}
                                            {opcao.origem === "prestador"
                                              ? " - Prestador"
                                              : " - Fornecedor"}
                                          </option>
                                        ))}
                                  </Select>
                                ) : (
                                  <Input
                                    label="Terceirizado"
                                    value={terceiro.nome}
                                    onChange={(e) =>
                                      selecionarTerceirizadoEdicao(index, e.target.value)
                                    }
                                    placeholder="Nome do prestador ou fornecedor"
                                  />
                                )}
                                <Input
                                  label="Serviço"
                                  value={terceiro.servico}
                                  onChange={(e) =>
                                    setTerceirizadosEdicao((atuais) =>
                                      atuais.map((item, i) =>
                                        i === index ? { ...item, servico: e.target.value } : item
                                      )
                                    )
                                  }
                                  placeholder="Serviço terceirizado"
                                />
                                <Input
                                  label="Comissão / Custo"
                                  value={terceiro.custo}
                                  onChange={(e) =>
                                    setTerceirizadosEdicao((atuais) =>
                                      atuais.map((item, i) =>
                                        i === index
                                          ? {
                                              ...item,
                                              custo: formatCurrencyInputControle(e.target.value),
                                            }
                                          : item
                                      )
                                    )
                                  }
                                  placeholder="R$ 0,00"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setTerceirizadosEdicao((atuais) =>
                                      atuais.filter((_, i) => i !== index)
                                    )
                                  }
                                  className="mt-6 inline-flex h-10 items-center justify-center rounded border border-red-200 px-3 text-red-600 hover:bg-red-50"
                                  title="Excluir serviço terceirizado"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                            {terceirizadosEdicao.length > 0 && (
                              <button
                                type="button"
                                onClick={adicionarLinhaTerceirizadoEdicao}
                                className="w-full rounded bg-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary-700"
                              >
                                + Adicionar Terceirizado
                              </button>
                            )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {painelEdicaoItem === "produto" && !adicionandoServico && (
                    <div className="space-y-3">
                      {produtosOs.length === 0 && (
                        <button
                          type="button"
                          onClick={adicionarLinhaProdutoEdicao}
                          className="w-full rounded bg-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary-700"
                        >
                          + Adicionar Produto
                        </button>
                      )}
                      {produtosOs.map((produtoOs, index) => (
                        <div
                          key={`${produtoOs.produtoId}-${index}`}
                          className="grid gap-3 rounded border border-slate-200 bg-white p-3 md:grid-cols-[1.4fr_0.7fr_1fr_1fr_auto]"
                        >
                          <Select
                            label="Produto cadastrado"
                            value={produtoOs.produtoId}
                            onChange={(e) => {
                              const produto = produtosCadastro.find((item) => item.id === e.target.value);
                              setProdutosOs((atuais) =>
                                atuais.map((item, i) =>
                                  i === index
                                    ? atualizarProdutoOsSelecao(item, produto, e.target.value)
                                    : item
                                )
                              );
                            }}
                          >
                            <option value="">Selecione um produto</option>
                            {produtosCadastro.map((produto) => (
                              <option key={produto.id} value={produto.id}>
                                {produto.nome} - {formatCurrency(produto.valor)}
                              </option>
                            ))}
                          </Select>
                          <Input
                            label="Quantidade"
                            type="number"
                            min="1"
                            value={produtoOs.quantidade}
                            onChange={(e) =>
                              setProdutosOs((atuais) =>
                                atuais.map((item, i) =>
                                  i === index
                                    ? atualizarProdutoOsQuantidade(item, e.target.value)
                                    : item
                                )
                              )
                            }
                          />
                          <Input
                            label="Valor"
                            selectOnFocus
                            value={produtoOs.valor}
                            onChange={(e) =>
                              setProdutosOs((atuais) =>
                                atuais.map((item, i) =>
                                  i === index
                                    ? atualizarProdutoOsValorTotal(item, e.target.value)
                                    : item
                                )
                              )
                            }
                          />
                          <Input
                            label="Observação"
                            value={produtoOs.observacao}
                            onChange={(e) =>
                              setProdutosOs((atuais) =>
                                atuais.map((item, i) =>
                                  i === index ? { ...item, observacao: e.target.value } : item
                                )
                              )
                            }
                            placeholder="Lote, marca ou detalhe"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const proximos = produtosOs.filter((_, i) => i !== index);
                              setProdutosOs(proximos);
                            }}
                            className="mt-6 inline-flex h-10 items-center justify-center rounded border border-red-200 px-3 text-red-600 hover:bg-red-50"
                            title="Excluir produto"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {painelEdicaoItem === "transporte" && (
                    <div className="grid gap-3 md:grid-cols-6">
                      <div className="md:col-span-3">
                        <Input
                          label="Transporte / Frete"
                          value={form.tipoProtese}
                          onChange={(e) => setForm({ ...form, tipoProtese: e.target.value })}
                          placeholder="Ex.: Transporte: Entrega expressa"
                        />
                      </div>
                      <Input
                        label="Qtd"
                        type="number"
                        min="1"
                        value={form.quantidade}
                        onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
                      />
                      <Input
                        label="Valor Un."
                        selectOnFocus
                        value={form.valor}
                        onChange={(e) =>
                          setForm({ ...form, valor: formatCurrencyInputControle(e.target.value) })
                        }
                      />
                      <Select
                        label="Situação"
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                      >
                        {Object.entries(STATUS_TRABALHO).map(([key, value]) => (
                          <option key={key} value={key}>
                            {value.label}
                          </option>
                        ))}
                      </Select>
                      <div className="md:col-span-6 flex items-center gap-2 text-sm text-primary-700">
                        <span>Total:</span>
                        <input
                          className="w-40 rounded border border-slate-200 px-3 py-2 text-right text-slate-700"
                          value={formatCurrency(totalServicoEdicao)}
                          readOnly
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={confirmarEdicaoItem}
                    disabled={osFaturada}
                    className={`mt-4 flex w-full items-center justify-center gap-2 rounded px-3 py-2 text-xs font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50 ${
                      avisoConfirmarItem
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-emerald-500 hover:bg-emerald-600"
                    }`}
                  >
                    {avisoConfirmarItem ? <AlertTriangle className="h-4 w-4" /> : null}
                    {avisoConfirmarItem ||
                      (itemSelecionadoId
                        ? "Atualizar Item Selecionado"
                        : adicionandoServico && abaServicoEdicao === "produtos"
                          ? "+ Adicionar Produto"
                          : painelEdicaoItem === "produto"
                            ? "+ Adicionar Produto"
                            : painelEdicaoItem === "transporte"
                              ? "+ Adicionar Transporte"
                              : "+ Adicionar Serviço")}
                  </button>
                </div>
              </section>
              )}
            </div>

            <div className="flex shrink-0 flex-wrap justify-between gap-2 border-t border-slate-100 bg-white p-4">
              <Button
                type="button"
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50"
                onClick={fecharEdicaoOs}
              >
                Fechar / Cancelar
              </Button>
              <Button
                type="button"
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={salvandoEdicao}
                onClick={salvarEdicao}
              >
                <Save className={cn("h-4 w-4", salvandoEdicao && "animate-spin")} />
                {salvandoEdicao
                  ? "Salvando..."
                  : osFaturada
                    ? "Gravar observação e comissões"
                    : "Gravar Alterações Ordem de Serviço"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ImprimirOsModal
        open={!!imprimirOs}
        onClose={() => setImprimirOs(null)}
        trabalho={imprimirOs}
        multiplosSegmentos={
          imprimirOs
            ? grupoOsTemMultiplosSegmentos(
                trabalhos.filter((item) => chaveGrupoOs(item) === chaveGrupoOs(imprimirOs))
              )
            : false
        }
      />
    </div>
  );
}

function Detail({ label, value, emptyValue = "-" }: { label: string; value: string; emptyValue?: string }) {
  return (
    <div>
      <p className="font-semibold text-slate-500">{label}:</p>
      <p className="whitespace-pre-wrap text-slate-700">{value || emptyValue}</p>
    </div>
  );
}
