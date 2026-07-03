"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Home,
  Printer,
  X,
} from "lucide-react";
import { BadgeSituacaoOs } from "@/components/BadgeSituacaoOs";
import { CampoDataBr } from "@/components/campo-data-br";
import { PainelCarregando } from "@/components/ListaCarregando";
import { RelatorioProducaoEtapasImpressao } from "@/components/relatorios/RelatorioProducaoEtapasImpressao";
import { dateToBrShort } from "@/lib/datas-br";
import {
  colaboradoresParaExibicaoControle,
  parseColaboradoresInstrucoes,
  parseEtapasInstrucoes,
} from "@/lib/etapas-os";
import {
  OPCOES_RELATORIO_PRODUCAO,
  SITUACOES_FILTRO_RELATORIO_PRODUCAO,
  exportarRelatorioProducaoCsv,
  formatarPercentualRelatorio,
  gerarRelatorioProducao,
  layoutTabelaRelatorioProducao,
  totaisDoResultadoRelatorio,
  type FiltrosRelatorioProducao,
  type LinhaRelatorioProducao,
  type OpcaoRelatorioProducao,
  type OrdenacaoProducao,
  type ResultadoRelatorioProducao,
  type TrabalhoRelatorioProducao,
} from "@/lib/relatorio-producao";
import {
  carregarCategoriasPorTabelaPreco,
  type CategoriaTabelaPrecoOs,
} from "@/lib/tabela-precos-os";
import { TRABALHOS_ATUALIZADOS_EVENT } from "@/lib/trabalhos-events";
import { abrirPdfGerando } from "@/lib/pdf-viewer";
import { gerarRelatorioProducaoPdf } from "@/lib/relatorios-impressao-pdf";
import { cn } from "@/lib/utils";

const labelClass = "mb-1 block text-[11px] font-normal text-[#6b7280] dark:text-slate-400";
const selectClass =
  "h-[34px] w-full rounded-sm border border-[#d1d5db] dark:border-slate-600 bg-white dark:bg-slate-900 px-2 text-[12px] text-[#374151] dark:text-slate-200 outline-none focus:border-[#4a90d9]";

const inputDataRelatorioClass =
  "h-[34px] w-full rounded-sm border border-[#d1d5db] dark:border-slate-600 bg-white dark:bg-slate-900 text-[12px] text-[#374151] dark:text-slate-200 shadow-none focus:border-[#4a90d9] focus:ring-0";

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function primeiroDiaMesBr() {
  const hoje = new Date();
  return dateToBrShort(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
}

const OPCOES_SIM_NAO = [
  { value: "", label: "" },
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
] as const;

const COLUNAS_TABELA = [
  "DATA",
  "OS",
  "QTD",
  "DESCRIÇÃO",
  "COR",
  "DENTE",
  "CLIENTE",
  "PACIENTE",
  "COLABORADOR",
  "SITUAÇÃO",
  "VALOR",
] as const;

const COLUNAS_SERVICOS_AGRUPADOS = ["QUANTIDADE", "DESCRIÇÃO", "%", "VALOR"] as const;

const COLUNAS_SERVICOS_ETAPAS = [
  "",
  "DATA",
  "OS",
  "QTD",
  "DESCRIÇÃO",
  "COR",
  "DENTE",
  "CLIENTE",
  "PACIENTE",
  "DATA ENTREGUE",
  "SITUAÇÃO",
  "VALOR",
] as const;

const SUB_COLUNAS_ETAPAS = [
  "ETAPA",
  "COLABORADOR",
  "DATA INÍCIO",
  "DATA FIM",
  "TEMPO TOTAL (MIN)",
  "SITUAÇÃO",
] as const;

const LINHAS_POR_PAGINA = 20;

function paginarItens<T>(itens: T[], paginaSolicitada: number, porPagina: number) {
  const totalPaginas = Math.max(1, Math.ceil(itens.length / porPagina));
  const paginaAtual = Math.min(Math.max(1, paginaSolicitada), totalPaginas);
  const inicio = (paginaAtual - 1) * porPagina;
  return {
    itens: itens.slice(inicio, inicio + porPagina),
    paginaAtual,
    totalPaginas,
  };
}

type BlocoAgrupadoRelatorio = {
  id: string;
  titulo: string;
  dados: LinhaRelatorioProducao[];
  subtotal: LinhaRelatorioProducao;
};

function extrairBlocosAgrupadosRelatorio(
  linhas: LinhaRelatorioProducao[]
): BlocoAgrupadoRelatorio[] {
  const blocos: BlocoAgrupadoRelatorio[] = [];
  let atual: BlocoAgrupadoRelatorio | null = null;

  for (const linha of linhas) {
    if (linha.tipo === "grupo") {
      atual = {
        id: linha.id,
        titulo: linha.descricao,
        dados: [],
        subtotal: linha,
      };
      blocos.push(atual);
      continue;
    }
    if (linha.tipo === "subtotal" && atual) {
      atual.subtotal = linha;
      atual = null;
      continue;
    }
    if (linha.tipo === "dados" && atual) {
      atual.dados.push(linha);
    }
  }

  return blocos;
}

function PaginacaoRelatorioControles({
  pagina,
  totalPaginas,
  onPagina,
  colSpan,
}: {
  pagina: number;
  totalPaginas: number;
  onPagina: (pagina: number) => void;
  colSpan: number;
}) {
  if (totalPaginas <= 1) return null;

  const botoes: number[] = [];
  const inicio = Math.max(1, pagina - 2);
  const fim = Math.min(totalPaginas, inicio + 4);
  for (let p = inicio; p <= fim; p += 1) botoes.push(p);

  return (
    <tr className="print:hidden">
      <td colSpan={colSpan} className="border-b border-[#e5e7eb] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2">
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <button
            type="button"
            disabled={pagina <= 1}
            onClick={() => onPagina(pagina - 1)}
            className="rounded border border-[#d1d5db] dark:border-slate-600 px-2 py-0.5 text-[11px] text-[#374151] dark:text-slate-200 hover:bg-[#f3f4f6] dark:hover:bg-slate-700 dark:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Anterior
          </button>
          {botoes.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPagina(p)}
              className={cn(
                "min-w-[28px] rounded border px-2 py-0.5 text-[11px] font-medium",
                p === pagina
                  ? "border-[#4a90d9] bg-[#4a90d9] text-white"
                  : "border-[#d1d5db] dark:border-slate-600 bg-white dark:bg-slate-900 text-[#374151] dark:text-slate-200 hover:bg-[#f3f4f6] dark:hover:bg-slate-700 dark:bg-slate-800"
              )}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            disabled={pagina >= totalPaginas}
            onClick={() => onPagina(pagina + 1)}
            className="rounded border border-[#d1d5db] dark:border-slate-600 px-2 py-0.5 text-[11px] text-[#374151] dark:text-slate-200 hover:bg-[#f3f4f6] dark:hover:bg-slate-700 dark:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Próxima
          </button>
          <span className="ml-1 text-[10px] text-[#9ca3af] dark:text-slate-500">
            Página {pagina} de {totalPaginas}
          </span>
        </div>
      </td>
    </tr>
  );
}

function LinhaDadosRelatorioTabela({ linha }: { linha: LinhaRelatorioProducao }) {
  return (
    <>
      <td className="px-2 py-2 text-[#374151] dark:text-slate-200">{linha.data}</td>
      <td className="px-2 py-2 text-right text-[#374151] dark:text-slate-200">{linha.os}</td>
      <td className="px-2 py-2 text-right text-[#374151] dark:text-slate-200">{linha.qtd}</td>
      <td className="px-2 py-2 text-[#374151] dark:text-slate-200">{linha.descricao}</td>
      <td className="px-2 py-2 text-[#374151] dark:text-slate-200">{linha.cor}</td>
      <td className="px-2 py-2 text-[#374151] dark:text-slate-200">{linha.dente}</td>
      <td className="px-2 py-2 text-[#374151] dark:text-slate-200">{linha.cliente}</td>
      <td className="px-2 py-2 text-[#374151] dark:text-slate-200">{linha.paciente}</td>
      <td className="px-2 py-2 text-[#374151] dark:text-slate-200">{linha.colaborador}</td>
      <td className="px-2 py-2">
        <BadgeSituacaoOs status={linha.situacaoKey} />
      </td>
      <td className="px-2 py-2 text-right text-[#374151] dark:text-slate-200">
        {typeof linha.valor === "number" ? money(linha.valor) : ""}
      </td>
    </>
  );
}

function SelectSituacaoMulti({
  selecionados,
  onChange,
}: {
  selecionados: string[];
  onChange: (keys: string[]) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [posicao, setPosicao] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const anchorRef = useRef<HTMLDivElement>(null);

  const atualizarPosicao = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPosicao({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    if (!aberto) return;
    atualizarPosicao();
    const onScroll = () => atualizarPosicao();
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [aberto, atualizarPosicao]);

  function alternar(key: string) {
    if (selecionados.includes(key)) {
      onChange(selecionados.filter((k) => k !== key));
    } else {
      onChange([...selecionados, key]);
    }
  }

  function removerChip(key: string, e: React.MouseEvent) {
    e.stopPropagation();
    onChange(selecionados.filter((k) => k !== key));
  }

  const labelPorKey = (key: string) =>
    SITUACOES_FILTRO_RELATORIO_PRODUCAO.find((s) => s.key === key)?.label ?? key;

  const listaSituacoes = (
    <ul
      className="max-h-56 overflow-auto rounded-sm border border-[#d1d5db] dark:border-slate-600 bg-white dark:bg-slate-900 py-1 shadow-lg"
      style={posicao ? { width: posicao.width } : undefined}
    >
      {SITUACOES_FILTRO_RELATORIO_PRODUCAO.map((item) => {
        const ativo = selecionados.includes(item.key);
        return (
          <li key={item.key}>
            <button
              type="button"
              className={cn(
                "flex w-full items-center justify-between px-3 py-2 text-left text-[12px]",
                ativo
                  ? "bg-[#4a90d9] font-medium text-white"
                  : "text-[#374151] dark:text-slate-200 hover:bg-[#f3f4f6] dark:hover:bg-slate-700 dark:bg-slate-800"
              )}
              onClick={() => alternar(item.key)}
            >
              <span>{item.label}</span>
              {ativo && <Check className="h-4 w-4 shrink-0" />}
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="relative" ref={anchorRef}>
      <label className={labelClass}>Situação</label>
      <button
        type="button"
        onClick={() => {
          if (aberto) {
            setAberto(false);
            return;
          }
          atualizarPosicao();
          setAberto(true);
        }}
        className="flex min-h-[34px] w-full flex-wrap items-center gap-1 rounded-sm border border-[#d1d5db] dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-left text-[12px] outline-none focus:border-[#4a90d9]"
        aria-expanded={aberto}
      >
        {selecionados.length === 0 ? (
          <span className="text-[#9ca3af] dark:text-slate-500">&nbsp;</span>
        ) : (
          selecionados.map((key) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 rounded-sm bg-[#4a90d9] px-1.5 py-0.5 text-[11px] font-medium text-white"
            >
              {labelPorKey(key)}
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => removerChip(key, e)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") removerChip(key, e as unknown as React.MouseEvent);
                }}
                className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm hover:bg-[#3d7fc4]"
              >
                <X className="h-2.5 w-2.5" />
              </span>
            </span>
          ))
        )}
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-[#9ca3af] dark:text-slate-500" />
      </button>
      {aberto &&
        posicao &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-[9998] cursor-default bg-transparent"
              aria-label="Fechar"
              onClick={() => setAberto(false)}
            />
            <div
              className="fixed z-[9999]"
              style={{ top: posicao.top, left: posicao.left, width: posicao.width }}
              role="listbox"
              aria-label="Situação"
            >
              {listaSituacoes}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

export function RelatorioProducaoConteudo() {
  const [carregando, setCarregando] = useState(true);
  const [trabalhos, setTrabalhos] = useState<TrabalhoRelatorioProducao[]>([]);
  const [gerado, setGerado] = useState(false);
  const [linhasExpandidas, setLinhasExpandidas] = useState<Set<string>>(new Set());
  const [paginaLista, setPaginaLista] = useState(1);
  const [paginaPorBloco, setPaginaPorBloco] = useState<Record<string, number>>({});

  const [opcaoRelatorio, setOpcaoRelatorio] =
    useState<OpcaoRelatorioProducao>("servicos_lista");
  const [categoriasTabela, setCategoriasTabela] = useState<CategoriaTabelaPrecoOs[]>([]);
  const [campoPeriodo, setCampoPeriodo] = useState<
    "data_lancamento" | "data_entrega" | "data_prevista"
  >("data_lancamento");
  const [dataInicio, setDataInicio] = useState(primeiroDiaMesBr);
  const [dataFim, setDataFim] = useState(dateToBrShort(new Date()));
  const [situacoesSelecionadas, setSituacoesSelecionadas] = useState<string[]>([]);
  const [cliente, setCliente] = useState("Todos");
  const [colaborador, setColaborador] = useState("Todos");
  const [repeticao, setRepeticao] = useState("");
  const [urgente, setUrgente] = useState("");
  const [ordenacao, setOrdenacao] = useState<OrdenacaoProducao>("data");

  const layoutTabela = layoutTabelaRelatorioProducao(opcaoRelatorio);
  const modoServicosAgrupados = layoutTabela === "servicos_agrupados";
  const modoServicosEtapas = layoutTabela === "servicos_etapas";
  const colunasAtivas = modoServicosAgrupados
    ? COLUNAS_SERVICOS_AGRUPADOS
    : modoServicosEtapas
      ? COLUNAS_SERVICOS_ETAPAS
      : COLUNAS_TABELA;

  const recarregarTrabalhos = useCallback(async () => {
    try {
      const res = await fetch("/api/trabalhos", { cache: "no-store" });
      const data = res.ok ? await res.json() : [];
      setTrabalhos(Array.isArray(data) ? data : []);
    } catch {
      setTrabalhos([]);
    }
  }, []);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      await recarregarTrabalhos();
    } finally {
      setCarregando(false);
    }
  }, [recarregarTrabalhos]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  useEffect(() => {
    const atualizar = () => void recarregarTrabalhos();
    window.addEventListener(TRABALHOS_ATUALIZADOS_EVENT, atualizar);
    window.addEventListener("focus", atualizar);
    return () => {
      window.removeEventListener(TRABALHOS_ATUALIZADOS_EVENT, atualizar);
      window.removeEventListener("focus", atualizar);
    };
  }, [recarregarTrabalhos]);

  useEffect(() => {
    const porTabela = carregarCategoriasPorTabelaPreco();
    const tabela = "Tabela Principal";
    setCategoriasTabela(porTabela[tabela] || Object.values(porTabela)[0] || []);
  }, []);

  useEffect(() => {
    if (opcaoRelatorio === "servicos_agrupados") {
      setOrdenacao("servico");
    } else {
      setOrdenacao((atual) => (atual === "servico" ? "data" : atual));
    }
    setPaginaLista(1);
    setPaginaPorBloco({});
  }, [opcaoRelatorio]);

  const clientesOpcoes = useMemo(() => {
    const nomes = [
      ...new Set(trabalhos.map((t) => t.cliente?.nome?.trim()).filter(Boolean) as string[]),
    ].sort((a, b) => a.localeCompare(b, "pt-BR"));
    return ["Todos", ...nomes];
  }, [trabalhos]);

  const colaboradoresOpcoes = useMemo(() => {
    const nomes = new Set<string>();
    for (const t of trabalhos) {
      const etapas = parseEtapasInstrucoes(t.instrucoes);
      const cols = colaboradoresParaExibicaoControle(
        parseColaboradoresInstrucoes(t.instrucoes),
        etapas
      );
      cols.forEach((c) => {
        if (c.nome.trim()) nomes.add(c.nome.trim());
      });
    }
    return ["Todos", ...[...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"))];
  }, [trabalhos]);

  const filtros = useMemo<FiltrosRelatorioProducao>(
    () => ({
      dataInicio,
      dataFim,
      campoPeriodo,
      situacoes: situacoesSelecionadas,
      cliente,
      colaborador,
      repeticao,
      urgente,
      ordenacao,
      opcaoRelatorio,
    }),
    [
      dataInicio,
      dataFim,
      campoPeriodo,
      situacoesSelecionadas,
      cliente,
      colaborador,
      repeticao,
      urgente,
      ordenacao,
      opcaoRelatorio,
    ]
  );

  const resultado = useMemo<ResultadoRelatorioProducao | null>(() => {
    if (!gerado) return null;
    return gerarRelatorioProducao(trabalhos, filtros, { categoriasTabela });
  }, [gerado, trabalhos, filtros, categoriasTabela]);

  const linhas =
    resultado && resultado.layout !== "servicos_etapas" ? resultado.linhas : [];
  const linhasEtapas =
    resultado && resultado.layout === "servicos_etapas" ? resultado.linhas : [];

  const relatorioAgrupado = useMemo(
    () => !modoServicosAgrupados && linhas.some((l) => l.tipo === "grupo"),
    [linhas, modoServicosAgrupados]
  );

  const blocosAgrupados = useMemo(
    () => (relatorioAgrupado ? extrairBlocosAgrupadosRelatorio(linhas) : []),
    [linhas, relatorioAgrupado]
  );

  const linhasDadosLista = useMemo(
    () => linhas.filter((linha) => linha.tipo === "dados"),
    [linhas]
  );

  const paginacaoEtapas = useMemo(
    () => paginarItens(linhasEtapas, paginaLista, LINHAS_POR_PAGINA),
    [linhasEtapas, paginaLista]
  );

  const paginacaoServicosAgrupados = useMemo(
    () => paginarItens(linhasDadosLista, paginaLista, LINHAS_POR_PAGINA),
    [linhasDadosLista, paginaLista]
  );

  const paginacaoListaDetalhada = useMemo(
    () => paginarItens(linhasDadosLista, paginaLista, LINHAS_POR_PAGINA),
    [linhasDadosLista, paginaLista]
  );

  const totais = useMemo(
    () => (resultado ? totaisDoResultadoRelatorio(resultado) : { qtd: 0, registros: 0, valor: 0 }),
    [resultado]
  );

  const totalRegistrosExibidos = modoServicosEtapas
    ? linhasEtapas.length
    : relatorioAgrupado
      ? blocosAgrupados.reduce((s, b) => s + b.dados.length, 0)
      : linhas.filter((l) => l.tipo === "dados").length;

  function gerarRelatorio() {
    setLinhasExpandidas(new Set());
    setPaginaLista(1);
    setPaginaPorBloco({});
    setGerado(true);
  }

  function irParaPaginaLista(pagina: number) {
    setPaginaLista(Math.max(1, pagina));
  }

  function irParaPaginaBloco(blocoId: string, pagina: number) {
    setPaginaPorBloco((atual) => ({
      ...atual,
      [blocoId]: Math.max(1, pagina),
    }));
  }

  function alternarExpansao(id: string) {
    setLinhasExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function imprimir() {
    if (!gerado) gerarRelatorio();
    const dados =
      resultado ?? gerarRelatorioProducao(trabalhos, filtros, { categoriasTabela });
    const titulo =
      OPCOES_RELATORIO_PRODUCAO.find((o) => o.value === opcaoRelatorio)?.label ??
      "Relatório de Produção";

    if (dados.layout === "servicos_etapas") {
      window.print();
      return;
    }

    void abrirPdfGerando(
      () =>
        gerarRelatorioProducaoPdf(
          dados.linhas,
          titulo,
          `${dataInicio} à ${dataFim}`
        ),
      "relatorio-producao.pdf"
    );
  }

  function exportarExcel() {
    const dados =
      resultado ?? gerarRelatorioProducao(trabalhos, filtros, { categoriasTabela });
    exportarRelatorioProducaoCsv(dados, opcaoRelatorio);
  }

  if (carregando) {
    return (
      <div className="min-h-[320px] bg-[#f3f4f6] dark:bg-slate-950 pb-8 pt-1">
        <PainelCarregando mensagem="Carregando relatório de produção..." />
      </div>
    );
  }

  return (
    <div className="relatorio-producao bg-[#f3f4f6] dark:bg-slate-950 pb-8 pt-1 text-[12px] text-[#374151] dark:text-slate-200 print:bg-white">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-[22px] font-normal leading-none text-[#6b7280] dark:text-slate-400">Relatórios</h1>
        <div className="flex items-center gap-1.5 text-[12px] text-[#9ca3af] dark:text-slate-500">
          <Home className="h-3.5 w-3.5 shrink-0" />
          <span className="text-[#d1d5db] dark:text-slate-600">/</span>
          <span className="text-[#6b7280] dark:text-slate-400">Produção</span>
        </div>
      </div>

      <div
        id="relatorio-producao-impressao"
        className="space-y-4 print:space-y-2"
      >
        {/* Filtros */}
        <div className="overflow-visible rounded-sm border border-[#e5e7eb] dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm print:hidden">
          <div className="border-b border-[#e5e7eb] dark:border-slate-700 px-4 py-3">
            <p className="text-[13px] font-semibold text-[#374151] dark:text-slate-200">Relatórios</p>
          </div>
          <div className="space-y-3 px-4 py-4">
            <div className="grid gap-3 lg:grid-cols-12">
              <div className="lg:col-span-3">
                <label className={labelClass}>Opções de Relatório</label>
                <select
                  className={selectClass}
                  value={opcaoRelatorio}
                  onChange={(e) =>
                    setOpcaoRelatorio(e.target.value as OpcaoRelatorioProducao)
                  }
                >
                  {OPCOES_RELATORIO_PRODUCAO.map((op) => (
                    <option key={op.value} value={op.value} title={op.descricao}>
                      {op.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="lg:col-span-6">
                <label className={labelClass}>Período</label>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className={cn(selectClass, "min-w-[140px] flex-1")}
                    value={campoPeriodo}
                    onChange={(e) =>
                      setCampoPeriodo(
                        e.target.value as "data_lancamento" | "data_entrega" | "data_prevista"
                      )
                    }
                  >
                    <option value="data_lancamento">Data Lançamento</option>
                    <option value="data_entrega">Data Entrega</option>
                    <option value="data_prevista">Data Prevista</option>
                  </select>
                  <CampoDataBr
                    value={dataInicio}
                    onChange={setDataInicio}
                    iconPosition="left"
                    className="min-w-0 flex-1 space-y-0"
                    inputClassName={inputDataRelatorioClass}
                  />
                  <CampoDataBr
                    value={dataFim}
                    onChange={setDataFim}
                    iconPosition="left"
                    className="min-w-0 flex-1 space-y-0"
                    inputClassName={inputDataRelatorioClass}
                  />
                </div>
              </div>
              <div className="lg:col-span-3">
                <SelectSituacaoMulti
                  selecionados={situacoesSelecionadas}
                  onChange={setSituacoesSelecionadas}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label className={labelClass}>Clientes</label>
                <select
                  className={selectClass}
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                >
                  {clientesOpcoes.map((c) => (
                    <option key={c} value={c}>
                      {c === "Todos" ? "" : c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Colaboradores</label>
                <select
                  className={selectClass}
                  value={colaborador}
                  onChange={(e) => setColaborador(e.target.value)}
                >
                  {colaboradoresOpcoes.map((c) => (
                    <option key={c} value={c}>
                      {c === "Todos" ? "" : c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Repetição</label>
                <select
                  className={selectClass}
                  value={repeticao}
                  onChange={(e) => setRepeticao(e.target.value)}
                >
                  {OPCOES_SIM_NAO.map((op) => (
                    <option key={op.value || "todos"} value={op.value}>
                      {op.label || "\u00a0"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Urgente</label>
                <select
                  className={selectClass}
                  value={urgente}
                  onChange={(e) => setUrgente(e.target.value)}
                >
                  {OPCOES_SIM_NAO.map((op) => (
                    <option key={op.value || "todos"} value={op.value}>
                      {op.label || "\u00a0"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Ordenar por:</label>
                <select
                  className={selectClass}
                  value={ordenacao}
                  onChange={(e) => setOrdenacao(e.target.value as OrdenacaoProducao)}
                >
                  {modoServicosAgrupados ? (
                    <option value="servico">Serviço</option>
                  ) : (
                    <>
                      <option value="data">Data</option>
                      <option value="os">OS</option>
                      <option value="cliente">Cliente</option>
                      <option value="paciente">Paciente</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={gerarRelatorio}
                className="inline-flex h-[34px] items-center gap-2 rounded-sm bg-[#5cb85c] px-4 text-[12px] font-semibold text-white hover:bg-[#4cae4c]"
              >
                <FileText className="h-4 w-4" />
                Gerar Relatório
              </button>
              <button
                type="button"
                onClick={imprimir}
                className="inline-flex h-[34px] items-center gap-2 rounded-sm bg-[#4a90d9] px-4 text-[12px] font-semibold text-white hover:bg-[#3d7fc4]"
              >
                <Printer className="h-4 w-4" />
                Imprimir
              </button>
              <button
                type="button"
                onClick={exportarExcel}
                className="flex h-[34px] w-[34px] items-center justify-center rounded-sm bg-[#5cb85c] text-white hover:bg-[#4cae4c]"
                title="Exportar Excel"
              >
                <FileSpreadsheet className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {modoServicosEtapas && gerado && linhasEtapas.length > 0 && (
          <RelatorioProducaoEtapasImpressao
            linhas={linhasEtapas}
            dataInicio={dataInicio}
            dataFim={dataFim}
            className="hidden print:block"
          />
        )}

        {/* Tabela */}
        <div
          className={cn(
            "overflow-hidden rounded-sm border border-[#e5e7eb] dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm print:border-0 print:shadow-none",
            modoServicosEtapas && "print:hidden"
          )}
        >
          <div className="overflow-x-auto">
            <table
              className={cn(
                "w-full border-collapse text-[11px]",
                modoServicosAgrupados
                  ? "min-w-[640px]"
                  : modoServicosEtapas
                    ? "min-w-[1200px]"
                    : "min-w-[1100px]"
              )}
            >
              <thead>
                <tr className="border-b border-[#e5e7eb] dark:border-slate-700 bg-[#f9fafb] dark:bg-slate-800/70 text-[#6b7280] dark:text-slate-400">
                  {colunasAtivas.map((col) => (
                    <th
                      key={col}
                      className={cn(
                        "px-3 py-2.5 font-semibold uppercase",
                        col === "VALOR" ||
                          col === "QTD" ||
                          col === "OS" ||
                          col === "QUANTIDADE" ||
                          col === "%"
                          ? "text-right"
                          : "text-left",
                        col === "DESCRIÇÃO" && modoServicosAgrupados && "w-[55%]"
                      )}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!gerado ? (
                  <tr>
                    <td
                      colSpan={colunasAtivas.length}
                      className="h-[280px] text-center text-[#9ca3af] dark:text-slate-500"
                    >
                      Clique em Gerar Relatório para exibir os dados.
                    </td>
                  </tr>
                ) : totalRegistrosExibidos === 0 ? (
                  <tr>
                    <td
                      colSpan={colunasAtivas.length}
                      className="h-[280px] text-center text-[#9ca3af] dark:text-slate-500"
                    >
                      Nenhum registro encontrado no período.
                    </td>
                  </tr>
                ) : modoServicosEtapas ? (
                  <>
                    {paginacaoEtapas.itens.map((linha) => {
                      const expandido = linhasExpandidas.has(linha.id);
                      return (
                        <Fragment key={linha.id}>
                          <tr className="border-b border-[#f3f4f6] hover:bg-[#fafafa] dark:bg-slate-800/70">
                            <td className="w-8 px-1 py-2">
                              <button
                                type="button"
                                onClick={() => alternarExpansao(linha.id)}
                                className="flex h-6 w-6 items-center justify-center rounded-sm text-[#6b7280] dark:text-slate-400 hover:bg-[#f3f4f6] dark:hover:bg-slate-700 dark:bg-slate-800"
                                aria-expanded={expandido}
                                aria-label={expandido ? "Recolher etapas" : "Expandir etapas"}
                              >
                                {expandido ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </button>
                            </td>
                            <td className="px-2 py-2 text-[#374151] dark:text-slate-200">{linha.data}</td>
                            <td className="px-2 py-2 text-right text-[#374151] dark:text-slate-200">{linha.os}</td>
                            <td className="px-2 py-2 text-right text-[#374151] dark:text-slate-200">{linha.qtd}</td>
                            <td className="px-2 py-2 text-[#374151] dark:text-slate-200">{linha.descricao}</td>
                            <td className="px-2 py-2 text-[#374151] dark:text-slate-200">{linha.cor}</td>
                            <td className="px-2 py-2 text-[#374151] dark:text-slate-200">{linha.dente}</td>
                            <td className="px-2 py-2 text-[#374151] dark:text-slate-200">{linha.cliente}</td>
                            <td className="px-2 py-2 text-[#374151] dark:text-slate-200">{linha.paciente}</td>
                            <td className="px-2 py-2 text-[#374151] dark:text-slate-200">{linha.dataEntregue}</td>
                            <td className="px-2 py-2">
                              <BadgeSituacaoOs status={linha.situacaoKey} />
                            </td>
                            <td className="px-2 py-2 text-right text-[#374151] dark:text-slate-200">
                              {money(linha.valor)}
                            </td>
                          </tr>
                          {expandido && (
                            <tr className="border-b border-[#e5e7eb] dark:border-slate-700 bg-[#fafafa] dark:bg-slate-800/70">
                              <td colSpan={COLUNAS_SERVICOS_ETAPAS.length} className="px-6 py-3">
                                <p className="mb-2 text-[11px] font-semibold uppercase text-[#6b7280] dark:text-slate-400">
                                  Etapas
                                </p>
                                <table className="w-full max-w-4xl border-collapse text-[11px]">
                                  <thead>
                                    <tr className="border-b border-[#e5e7eb] dark:border-slate-700 bg-[#f3f4f6] dark:bg-slate-950 text-[#6b7280] dark:text-slate-400">
                                      {SUB_COLUNAS_ETAPAS.map((col) => (
                                        <th
                                          key={col}
                                          className={cn(
                                            "px-2 py-2 font-semibold uppercase",
                                            col === "TEMPO TOTAL (MIN)" ? "text-right" : "text-left"
                                          )}
                                        >
                                          {col}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {linha.etapas.length === 0 ? (
                                      <tr>
                                        <td
                                          colSpan={SUB_COLUNAS_ETAPAS.length}
                                          className="px-2 py-3 text-center text-[#9ca3af] dark:text-slate-500"
                                        >
                                          Nenhuma etapa cadastrada nesta OS.
                                        </td>
                                      </tr>
                                    ) : (
                                      linha.etapas.map((etapa) => (
                                        <tr
                                          key={etapa.id}
                                          className="border-b border-[#f3f4f6] bg-white dark:bg-slate-900"
                                        >
                                          <td className="px-2 py-2 text-[#374151] dark:text-slate-200">
                                            {etapa.etapa}
                                          </td>
                                          <td className="px-2 py-2 text-[#374151] dark:text-slate-200">
                                            {etapa.colaborador}
                                          </td>
                                          <td className="px-2 py-2 text-[#374151] dark:text-slate-200">
                                            {etapa.dataInicio || "—"}
                                          </td>
                                          <td className="px-2 py-2 text-[#374151] dark:text-slate-200">
                                            {etapa.dataFim || "—"}
                                          </td>
                                          <td className="px-2 py-2 text-right text-[#374151] dark:text-slate-200">
                                            {etapa.tempoMinutos}
                                          </td>
                                          <td className="px-2 py-2">
                                            <BadgeSituacaoOs status={etapa.situacaoKey} />
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                  <tfoot>
                                    <tr className="bg-[#e8f4fc]">
                                      <td
                                        colSpan={4}
                                        className="px-2 py-2 font-semibold text-[#4a90d9]"
                                      >
                                        Tempo Total (minutos)
                                      </td>
                                      <td className="px-2 py-2 text-right font-semibold text-[#4a90d9]">
                                        {linha.tempoTotalMinutos}
                                      </td>
                                      <td className="px-2 py-2" />
                                    </tr>
                                  </tfoot>
                                </table>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                    <PaginacaoRelatorioControles
                      pagina={paginacaoEtapas.paginaAtual}
                      totalPaginas={paginacaoEtapas.totalPaginas}
                      onPagina={irParaPaginaLista}
                      colSpan={colunasAtivas.length}
                    />
                  </>
                ) : modoServicosAgrupados ? (
                  <>
                    {paginacaoServicosAgrupados.itens.map((linha) => (
                      <tr
                        key={linha.id}
                        className="border-b border-[#f3f4f6] hover:bg-[#fafafa] dark:bg-slate-800/70"
                      >
                        <td className="px-3 py-2.5 text-right text-[#374151] dark:text-slate-200">{linha.qtd}</td>
                        <td className="px-3 py-2.5 text-[#374151] dark:text-slate-200">{linha.descricao}</td>
                        <td className="px-3 py-2.5 text-right text-[#374151] dark:text-slate-200">
                          {formatarPercentualRelatorio(linha.percentual ?? 0)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-[#374151] dark:text-slate-200">
                          {typeof linha.valor === "number" ? money(linha.valor) : ""}
                        </td>
                      </tr>
                    ))}
                    <PaginacaoRelatorioControles
                      pagina={paginacaoServicosAgrupados.paginaAtual}
                      totalPaginas={paginacaoServicosAgrupados.totalPaginas}
                      onPagina={irParaPaginaLista}
                      colSpan={colunasAtivas.length}
                    />
                  </>
                ) : relatorioAgrupado ? (
                  blocosAgrupados.flatMap((bloco) => {
                    const totalPaginas = Math.max(
                      1,
                      Math.ceil(bloco.dados.length / LINHAS_POR_PAGINA)
                    );
                    const paginaSolicitada = paginaPorBloco[bloco.id] ?? 1;
                    const paginaAtual = Math.min(paginaSolicitada, totalPaginas);
                    const inicio = (paginaAtual - 1) * LINHAS_POR_PAGINA;
                    const dadosPagina = bloco.dados.slice(
                      inicio,
                      inicio + LINHAS_POR_PAGINA
                    );
                    const idsPagina = new Set(dadosPagina.map((l) => l.id));

                    return [
                      <tr key={`${bloco.id}-grupo`} className="bg-[#e5e7eb]">
                        <td
                          colSpan={colunasAtivas.length}
                          className="px-3 py-2 text-[12px] font-semibold uppercase text-[#374151] dark:text-slate-200"
                        >
                          {bloco.titulo}
                        </td>
                      </tr>,
                      ...bloco.dados.map((linha) =>
                        idsPagina.has(linha.id) ? (
                          <tr
                            key={`${linha.id}-tela`}
                            className="border-b border-[#f3f4f6] hover:bg-[#fafafa] dark:bg-slate-800/70 print:hidden"
                          >
                            <LinhaDadosRelatorioTabela linha={linha} />
                          </tr>
                        ) : null
                      ),
                      ...bloco.dados.map((linha) => (
                        <tr
                          key={`${linha.id}-impressao`}
                          className="hidden border-b border-[#f3f4f6] print:table-row"
                        >
                          <LinhaDadosRelatorioTabela linha={linha} />
                        </tr>
                      )),
                      <PaginacaoRelatorioControles
                        key={`${bloco.id}-pag`}
                        pagina={paginaAtual}
                        totalPaginas={totalPaginas}
                        onPagina={(p) => irParaPaginaBloco(bloco.id, p)}
                        colSpan={colunasAtivas.length}
                      />,
                      <tr
                        key={`${bloco.id}-subtotal`}
                        className="border-b border-[#d1d5db] dark:border-slate-600 bg-[#f3f4f6] dark:bg-slate-950 font-semibold"
                      >
                        <td className="px-2 py-2" colSpan={2} />
                        <td className="px-2 py-2 text-right text-[#374151] dark:text-slate-200">
                          {bloco.subtotal.qtd}
                        </td>
                        <td className="px-2 py-2 text-[#374151] dark:text-slate-200" colSpan={7}>
                          {bloco.subtotal.descricao}
                        </td>
                        <td className="px-2 py-2 text-right text-[#4a90d9]">
                          {typeof bloco.subtotal.valor === "number"
                            ? money(bloco.subtotal.valor)
                            : ""}
                        </td>
                      </tr>,
                    ].filter(Boolean);
                  })
                ) : (
                  <>
                    {paginacaoListaDetalhada.itens.map((linha) => (
                      <tr
                        key={linha.id}
                        className="border-b border-[#f3f4f6] hover:bg-[#fafafa] dark:bg-slate-800/70"
                      >
                        <LinhaDadosRelatorioTabela linha={linha} />
                      </tr>
                    ))}
                    <PaginacaoRelatorioControles
                      pagina={paginacaoListaDetalhada.paginaAtual}
                      totalPaginas={paginacaoListaDetalhada.totalPaginas}
                      onPagina={irParaPaginaLista}
                      colSpan={colunasAtivas.length}
                    />
                  </>
                )}
              </tbody>
              {gerado && (
                <tfoot>
                  <tr className="border-t border-[#e5e7eb] dark:border-slate-700 bg-[#f9fafb] dark:bg-slate-800/70 font-semibold">
                    {modoServicosAgrupados ? (
                      <>
                        <td className="px-3 py-2.5 text-[#4a90d9]">
                          Total Quantidade Serviços:{" "}
                          <span className="text-[#4a90d9]">{totais.qtd}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center text-[#4a90d9]">
                          {totais.registros} Registros
                        </td>
                        <td className="px-3 py-2.5" />
                        <td className="px-3 py-2.5 text-right text-[#4a90d9]">
                          Total {money(totais.valor)}
                        </td>
                      </>
                    ) : modoServicosEtapas ? (
                      <>
                        <td colSpan={4} className="px-2 py-2.5 text-[#4a90d9]">
                          Total Quantidade Serviços:{" "}
                          <span className="text-[#4a90d9]">{totais.qtd}</span>
                        </td>
                        <td colSpan={4} className="px-2 py-2.5 text-center text-[#4a90d9]">
                          {totais.registros} Registros
                        </td>
                        <td colSpan={4} className="px-2 py-2.5 text-right text-[#4a90d9]">
                          Total {money(totais.valor)}
                        </td>
                      </>
                    ) : (
                      <>
                        <td colSpan={3} className="px-2 py-2.5 text-[#4a90d9]">
                          Total Quantidade Serviços:{" "}
                          <span className="text-[#4a90d9]">{totais.qtd}</span>
                        </td>
                        <td colSpan={5} className="px-2 py-2.5 text-center text-[#4a90d9]">
                          {totais.registros} Registros
                        </td>
                        <td colSpan={3} className="px-2 py-2.5 text-right text-[#4a90d9]">
                          Total {money(totais.valor)}
                        </td>
                      </>
                    )}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            margin: 12mm 10mm;
          }
          body * {
            visibility: hidden;
          }
          #relatorio-producao-impressao,
          #relatorio-producao-impressao * {
            visibility: visible;
          }
          #relatorio-producao-impressao {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .relatorio-producao-etapas-print {
            visibility: visible !important;
          }
        }
      `}</style>
    </div>
  );
}
