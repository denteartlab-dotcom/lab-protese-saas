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

const labelClass = "mb-1 block text-[11px] font-normal text-[#6b7280]";
const selectClass =
  "h-[34px] w-full rounded-sm border border-[#d1d5db] bg-white px-2 text-[12px] text-[#374151] outline-none focus:border-[#4a90d9]";

const inputDataRelatorioClass =
  "h-[34px] w-full rounded-sm border border-[#d1d5db] bg-white text-[12px] text-[#374151] shadow-none focus:border-[#4a90d9] focus:ring-0";

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
      className="max-h-56 overflow-auto rounded-sm border border-[#d1d5db] bg-white py-1 shadow-lg"
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
                  : "text-[#374151] hover:bg-[#f3f4f6]"
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
        className="flex min-h-[34px] w-full flex-wrap items-center gap-1 rounded-sm border border-[#d1d5db] bg-white px-2 py-1.5 text-left text-[12px] outline-none focus:border-[#4a90d9]"
        aria-expanded={aberto}
      >
        {selecionados.length === 0 ? (
          <span className="text-[#9ca3af]">&nbsp;</span>
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
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-[#9ca3af]" />
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

  const totais = useMemo(
    () => (resultado ? totaisDoResultadoRelatorio(resultado) : { qtd: 0, registros: 0, valor: 0 }),
    [resultado]
  );

  const totalRegistrosExibidos = modoServicosEtapas
    ? linhasEtapas.length
    : linhas.length;

  function gerarRelatorio() {
    setLinhasExpandidas(new Set());
    setGerado(true);
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
      <div className="min-h-[320px] bg-[#f3f4f6] pb-8 pt-1">
        <PainelCarregando mensagem="Carregando relatório de produção..." />
      </div>
    );
  }

  return (
    <div className="relatorio-producao bg-[#f3f4f6] pb-8 pt-1 text-[12px] text-[#374151] print:bg-white">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-[22px] font-normal leading-none text-[#6b7280]">Relatórios</h1>
        <div className="flex items-center gap-1.5 text-[12px] text-[#9ca3af]">
          <Home className="h-3.5 w-3.5 shrink-0" />
          <span className="text-[#d1d5db]">/</span>
          <span className="text-[#6b7280]">Produção</span>
        </div>
      </div>

      <div
        id="relatorio-producao-impressao"
        className="space-y-4 print:space-y-2"
      >
        {/* Filtros */}
        <div className="overflow-visible rounded-sm border border-[#e5e7eb] bg-white shadow-sm print:hidden">
          <div className="border-b border-[#e5e7eb] px-4 py-3">
            <p className="text-[13px] font-semibold text-[#374151]">Relatórios</p>
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
            "overflow-hidden rounded-sm border border-[#e5e7eb] bg-white shadow-sm print:border-0 print:shadow-none",
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
                <tr className="border-b border-[#e5e7eb] bg-[#f9fafb] text-[#6b7280]">
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
                      className="h-[280px] text-center text-[#9ca3af]"
                    >
                      Clique em Gerar Relatório para exibir os dados.
                    </td>
                  </tr>
                ) : totalRegistrosExibidos === 0 ? (
                  <tr>
                    <td
                      colSpan={colunasAtivas.length}
                      className="h-[280px] text-center text-[#9ca3af]"
                    >
                      Nenhum registro encontrado no período.
                    </td>
                  </tr>
                ) : modoServicosEtapas ? (
                  linhasEtapas.map((linha) => {
                    const expandido = linhasExpandidas.has(linha.id);
                    return (
                      <Fragment key={linha.id}>
                        <tr className="border-b border-[#f3f4f6] hover:bg-[#fafafa]">
                          <td className="w-8 px-1 py-2">
                            <button
                              type="button"
                              onClick={() => alternarExpansao(linha.id)}
                              className="flex h-6 w-6 items-center justify-center rounded-sm text-[#6b7280] hover:bg-[#f3f4f6]"
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
                          <td className="px-2 py-2 text-[#374151]">{linha.data}</td>
                          <td className="px-2 py-2 text-right text-[#374151]">{linha.os}</td>
                          <td className="px-2 py-2 text-right text-[#374151]">{linha.qtd}</td>
                          <td className="px-2 py-2 text-[#374151]">{linha.descricao}</td>
                          <td className="px-2 py-2 text-[#374151]">{linha.cor}</td>
                          <td className="px-2 py-2 text-[#374151]">{linha.dente}</td>
                          <td className="px-2 py-2 text-[#374151]">{linha.cliente}</td>
                          <td className="px-2 py-2 text-[#374151]">{linha.paciente}</td>
                          <td className="px-2 py-2 text-[#374151]">{linha.dataEntregue}</td>
                          <td className="px-2 py-2">
                            <BadgeSituacaoOs status={linha.situacaoKey} />
                          </td>
                          <td className="px-2 py-2 text-right text-[#374151]">
                            {money(linha.valor)}
                          </td>
                        </tr>
                        {expandido && (
                          <tr className="border-b border-[#e5e7eb] bg-[#fafafa]">
                            <td colSpan={COLUNAS_SERVICOS_ETAPAS.length} className="px-6 py-3">
                              <p className="mb-2 text-[11px] font-semibold uppercase text-[#6b7280]">
                                Etapas
                              </p>
                              <table className="w-full max-w-4xl border-collapse text-[11px]">
                                <thead>
                                  <tr className="border-b border-[#e5e7eb] bg-[#f3f4f6] text-[#6b7280]">
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
                                        className="px-2 py-3 text-center text-[#9ca3af]"
                                      >
                                        Nenhuma etapa cadastrada nesta OS.
                                      </td>
                                    </tr>
                                  ) : (
                                    linha.etapas.map((etapa) => (
                                      <tr
                                        key={etapa.id}
                                        className="border-b border-[#f3f4f6] bg-white"
                                      >
                                        <td className="px-2 py-2 text-[#374151]">
                                          {etapa.etapa}
                                        </td>
                                        <td className="px-2 py-2 text-[#374151]">
                                          {etapa.colaborador}
                                        </td>
                                        <td className="px-2 py-2 text-[#374151]">
                                          {etapa.dataInicio || "—"}
                                        </td>
                                        <td className="px-2 py-2 text-[#374151]">
                                          {etapa.dataFim || "—"}
                                        </td>
                                        <td className="px-2 py-2 text-right text-[#374151]">
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
                  })
                ) : modoServicosAgrupados ? (
                  linhas
                    .filter((linha) => linha.tipo === "dados")
                    .map((linha) => (
                      <tr
                        key={linha.id}
                        className="border-b border-[#f3f4f6] hover:bg-[#fafafa]"
                      >
                        <td className="px-3 py-2.5 text-right text-[#374151]">{linha.qtd}</td>
                        <td className="px-3 py-2.5 text-[#374151]">{linha.descricao}</td>
                        <td className="px-3 py-2.5 text-right text-[#374151]">
                          {formatarPercentualRelatorio(linha.percentual ?? 0)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-[#374151]">
                          {typeof linha.valor === "number" ? money(linha.valor) : ""}
                        </td>
                      </tr>
                    ))
                ) : (
                  linhas.map((linha) => {
                    if (linha.tipo === "grupo") {
                      return (
                        <tr key={linha.id} className="bg-[#e5e7eb]">
                          <td
                            colSpan={colunasAtivas.length}
                            className="px-3 py-2 text-[12px] font-semibold uppercase text-[#374151]"
                          >
                            {linha.descricao}
                          </td>
                        </tr>
                      );
                    }
                    if (linha.tipo === "subtotal") {
                      return (
                        <tr
                          key={linha.id}
                          className="border-b border-[#d1d5db] bg-[#f3f4f6] font-semibold"
                        >
                          <td className="px-2 py-2" colSpan={2} />
                          <td className="px-2 py-2 text-right text-[#374151]">{linha.qtd}</td>
                          <td className="px-2 py-2 text-[#374151]" colSpan={7}>
                            {linha.descricao}
                          </td>
                          <td className="px-2 py-2 text-right text-[#4a90d9]">
                            {typeof linha.valor === "number" ? money(linha.valor) : ""}
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr
                        key={linha.id}
                        className="border-b border-[#f3f4f6] hover:bg-[#fafafa]"
                      >
                        <td className="px-2 py-2 text-[#374151]">{linha.data}</td>
                        <td className="px-2 py-2 text-right text-[#374151]">{linha.os}</td>
                        <td className="px-2 py-2 text-right text-[#374151]">{linha.qtd}</td>
                        <td className="px-2 py-2 text-[#374151]">{linha.descricao}</td>
                        <td className="px-2 py-2 text-[#374151]">{linha.cor}</td>
                        <td className="px-2 py-2 text-[#374151]">{linha.dente}</td>
                        <td className="px-2 py-2 text-[#374151]">{linha.cliente}</td>
                        <td className="px-2 py-2 text-[#374151]">{linha.paciente}</td>
                        <td className="px-2 py-2 text-[#374151]">{linha.colaborador}</td>
                        <td className="px-2 py-2">
                          <BadgeSituacaoOs status={linha.situacaoKey} />
                        </td>
                        <td className="px-2 py-2 text-right text-[#374151]">
                          {typeof linha.valor === "number" ? money(linha.valor) : ""}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {gerado && (
                <tfoot>
                  <tr className="border-t border-[#e5e7eb] bg-[#f9fafb] font-semibold">
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
