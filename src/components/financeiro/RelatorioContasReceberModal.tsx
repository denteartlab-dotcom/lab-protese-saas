"use client";

import { I18nPortal } from "@/components/I18nPortal";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, X } from "lucide-react";
import { BotoesExtratoCompartilhar } from "@/components/financeiro/BotoesExtratoCompartilhar";
import { EnviarExtratoWhatsappModal } from "@/components/financeiro/EnviarExtratoWhatsappModal";
import { CampoDataBr } from "@/components/campo-data-br";
import { SelectPesquisavel } from "@/components/SelectPesquisavel";
import { dateToBrShort } from "@/lib/datas-br";
import { exportarExtratoRelatorioExcel } from "@/lib/extrato-relatorio-export";
import type { LancamentoContasReceber } from "@/lib/contas-receber-financeiro";
import { prepararAbaPdf } from "@/lib/pdf-viewer";
import { abrirPdfBlobGerandoNoVisualizadorUnificado } from "@/lib/pdf-viewer-unificado";
import { cn } from "@/lib/utils";
import type { TrabalhoRelatorioFatura } from "@/lib/relatorio-faturas-modelo3-dados";
import {
  filtrarLinhasRelatorioContasReceber,
  gerarRelatorioContasReceberBlob,
  linhasRelatorioFromLancamentos,
  ordenarLinhasRelatorioContasReceber,
  type FiltroRelatorioContasReceber,
} from "@/lib/relatorio-contas-receber";
import {
  labelModeloRelatorioReceitas,
  MODELOS_RELATORIO_RECEITAS,
  modeloEhExtratoPorCliente,
  modeloEhParcelasAReceber,
  type ModeloRelatorioReceitas,
} from "@/lib/relatorio-receitas-modelos";

type Lancamento = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  data: string;
  createdAt?: string;
  status: string;
  formaPagamento?: string | null;
  cliente?: { id: string; nome: string } | null;
  trabalho?: { id: string; numeroOs: number } | null;
};

type ContatoClienteRelatorio = {
  id: string;
  nome: string;
  celular?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  lancamentos: Lancamento[];
  trabalhos?: TrabalhoRelatorioFatura[];
  contatosClientes?: ContatoClienteRelatorio[];
};

const labelClass = "mb-1.5 block text-xs font-medium text-slate-600";

const selectClass =
  "h-[34px] w-full rounded border border-slate-300 bg-white px-2.5 text-[13px] text-slate-800 outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]";

const inputDataClass =
  "h-[34px] w-full rounded border border-slate-300 py-0 pl-8 pr-2 text-[13px] shadow-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]";

function periodoMesAtual() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const inicio = new Date(hoje);
  inicio.setDate(1);
  const fim = new Date(hoje);
  fim.setMonth(hoje.getMonth() + 1, 0);
  return { inicio: dateToBrShort(inicio), fim: dateToBrShort(fim) };
}

export function RelatorioContasReceberModal({
  open,
  onClose,
  lancamentos,
  trabalhos = [],
  contatosClientes = [],
}: Props) {
  const { inicio: inicioPadrao, fim: fimPadrao } = periodoMesAtual();

  const [modelo, setModelo] = useState<ModeloRelatorioReceitas>("faturas-modelo-1");
  const [ordenarPor, setOrdenarPor] =
    useState<FiltroRelatorioContasReceber["ordenarPor"]>("data_lancamento");
  const [cliente, setCliente] = useState("todos");
  const [periodoCampo, setPeriodoCampo] =
    useState<FiltroRelatorioContasReceber["periodoCampo"]>("data_lancamento");
  const [periodoAtivo, setPeriodoAtivo] = useState(true);
  const [dataInicio, setDataInicio] = useState(inicioPadrao);
  const [dataFinal, setDataFinal] = useState(fimPadrao);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [parcelasSomenteAReceber, setParcelasSomenteAReceber] = useState(true);
  const [parcelasAgruparPorCliente, setParcelasAgruparPorCliente] = useState(true);
  const [recebimentosAgruparPorCliente, setRecebimentosAgruparPorCliente] = useState(true);
  const [whatsappExtratoAberto, setWhatsappExtratoAberto] = useState(false);

  useEffect(() => {
    if (!open) return;
    const { inicio, fim } = periodoMesAtual();
    setDataInicio(inicio);
    setDataFinal(fim);
    setCliente("todos");
    setOrdenarPor("data_lancamento");
    setPeriodoCampo("data_lancamento");
    setPeriodoAtivo(true);
    setModelo("faturas-modelo-1");
    setParcelasSomenteAReceber(true);
    setParcelasAgruparPorCliente(true);
    setRecebimentosAgruparPorCliente(true);
  }, [open]);

  const extratoExigeCliente = modeloEhExtratoPorCliente(modelo);

  const idsClientesAtivos = useMemo(
    () => new Set(contatosClientes.map((c) => c.id)),
    [contatosClientes]
  );

  const lancamentosAtivos = useMemo(() => {
    if (idsClientesAtivos.size === 0) return lancamentos;
    return lancamentos.filter((l) => {
      const id = l.cliente?.id;
      return !id || idsClientesAtivos.has(id);
    });
  }, [lancamentos, idsClientesAtivos]);

  const trabalhosAtivos = useMemo(() => {
    if (idsClientesAtivos.size === 0) return trabalhos;
    return trabalhos.filter((t) => {
      const id = t.cliente?.id;
      return !id || idsClientesAtivos.has(id);
    });
  }, [trabalhos, idsClientesAtivos]);

  const linhasBase = useMemo(
    () => linhasRelatorioFromLancamentos(lancamentosAtivos, trabalhosAtivos, modelo),
    [lancamentosAtivos, trabalhosAtivos, modelo]
  );

  const nomesClientes = useMemo(() => {
    const set = new Set<string>();
    for (const c of contatosClientes) {
      const nome = c.nome?.trim();
      if (nome) set.add(nome);
    }
    for (const l of lancamentosAtivos) {
      if (l.tipo !== "receita") continue;
      const nome = l.cliente?.nome?.trim();
      if (nome) set.add(nome);
    }
    return ["todos", ...Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"))];
  }, [contatosClientes, lancamentosAtivos]);

  const clientesNoSelect = useMemo(
    () =>
      extratoExigeCliente ? nomesClientes.filter((c) => c !== "todos") : nomesClientes,
    [nomesClientes, extratoExigeCliente]
  );

  useEffect(() => {
    if (extratoExigeCliente && cliente === "todos") {
      setCliente("");
    }
  }, [extratoExigeCliente, modelo, cliente]);

  const clienteExtratoSelecionado = useMemo(() => {
    if (!extratoExigeCliente || !cliente || cliente === "todos") return null;
    const nomeFiltro = cliente.trim().toLowerCase();
    const contato =
      contatosClientes.find((c) => c.nome.trim().toLowerCase() === nomeFiltro) ??
      contatosClientes.find((c) => c.id === cliente);
    const lancamentoCliente = lancamentosAtivos.find(
      (l) =>
        l.tipo === "receita" && l.cliente?.nome?.trim().toLowerCase() === nomeFiltro
    );
    return {
      nome: cliente,
      id: contato?.id ?? lancamentoCliente?.cliente?.id ?? null,
      celular: contato?.celular ?? null,
    };
  }, [extratoExigeCliente, cliente, contatosClientes, lancamentosAtivos]);

  function montarFiltro(): FiltroRelatorioContasReceber {
    return {
      modelo,
      ordenarPor,
      situacao: "todos",
      cliente,
      formaRecebimento: "todos",
      periodoCampo,
      periodoAtivo,
      dataInicio,
      dataFinal,
      parcelasSomenteAReceber: modeloEhParcelasAReceber(modelo)
        ? parcelasSomenteAReceber
        : undefined,
      parcelasAgruparPorCliente:
        modelo === "parcelas-a-receber-modelo-2" ? parcelasAgruparPorCliente : undefined,
    };
  }

  const opcoesExtratoPdf = useCallback(() => {
    const filtro = montarFiltro();
    const filtradas = filtrarLinhasRelatorioContasReceber(linhasBase, filtro);
    const ordenadas = ordenarLinhasRelatorioContasReceber(filtradas, ordenarPor, modelo);
    const modeloLabel = labelModeloRelatorioReceitas(modelo);
    const periodoLabel = filtro.periodoAtivo
      ? `${dataInicio} à ${dataFinal}`
      : "Período: todos";
    const nomeClienteExtrato = clienteExtratoSelecionado?.nome;
    const clienteIdExtrato = clienteExtratoSelecionado?.id ?? null;

    return {
      ordenadas,
      modeloLabel,
      periodoLabel,
      opcoes: {
        periodoCampo: filtro.periodoCampo,
        dataInicio: filtro.dataInicio,
        dataFinal: filtro.dataFinal,
        periodoAtivo: filtro.periodoAtivo,
        ordenarPor: filtro.ordenarPor,
        nomeClienteExtrato,
        clienteIdExtrato,
        lancamentos: lancamentosAtivos as LancamentoContasReceber[],
        trabalhos: trabalhosAtivos,
      },
    };
  }, [
    clienteExtratoSelecionado,
    dataFinal,
    dataInicio,
    lancamentosAtivos,
    linhasBase,
    modelo,
    ordenarPor,
    periodoAtivo,
    periodoCampo,
    parcelasAgruparPorCliente,
    parcelasSomenteAReceber,
    cliente,
    trabalhosAtivos,
  ]);

  function extratoPronto() {
    return Boolean(clienteExtratoSelecionado?.nome);
  }

  function exportarExtratoExcel() {
    if (!clienteExtratoSelecionado?.nome) {
      alert("Selecione um cliente para exportar o extrato.");
      return;
    }
    exportarExtratoRelatorioExcel(
      modelo,
      lancamentosAtivos as LancamentoContasReceber[],
      trabalhosAtivos,
      clienteExtratoSelecionado.nome,
      {
        periodoAtivo,
        dataInicio,
        dataFinal,
        periodoCampo,
        clienteId: clienteExtratoSelecionado.id,
      }
    );
  }

  function gerarPdfExtrato() {
    const { ordenadas, modeloLabel, periodoLabel, opcoes } = opcoesExtratoPdf();
    return gerarRelatorioContasReceberBlob(
      ordenadas,
      modeloLabel,
      periodoLabel,
      modelo,
      opcoes
    );
  }

  function imprimir() {
    const filtro = montarFiltro();
    const filtradas = filtrarLinhasRelatorioContasReceber(linhasBase, filtro);
    const ordenadas = ordenarLinhasRelatorioContasReceber(
      filtradas,
      ordenarPor,
      modelo
    );
    const modeloLabel = labelModeloRelatorioReceitas(modelo);
    const periodoLabel = filtro.periodoAtivo
      ? `${dataInicio} à ${dataFinal}`
      : "Período: todos";
    if (extratoExigeCliente && (!filtro.cliente || filtro.cliente === "todos")) {
      alert("Selecione um cliente para gerar o Extrato Financeiro.");
      return;
    }

    const nomeClienteExtrato =
      filtro.cliente !== "todos" ? filtro.cliente : undefined;
    const nomeClienteFiltro = (nomeClienteExtrato ?? "").trim().toLowerCase();
    const clienteIdExtrato = nomeClienteExtrato
      ? lancamentosAtivos.find(
          (l) =>
            l.tipo === "receita" &&
            l.cliente?.nome?.trim().toLowerCase() === nomeClienteFiltro
        )?.cliente?.id ?? null
      : null;

    if (extratoExigeCliente && !nomeClienteExtrato) {
      alert("Selecione um cliente para gerar o Extrato Financeiro.");
      return;
    }

    setGerandoPdf(true);
    const janela = prepararAbaPdf();
    void abrirPdfBlobGerandoNoVisualizadorUnificado(
      () =>
        gerarRelatorioContasReceberBlob(
          ordenadas,
          modeloLabel,
          periodoLabel,
          modelo,
          {
            periodoCampo: filtro.periodoCampo,
            dataInicio: filtro.dataInicio,
            dataFinal: filtro.dataFinal,
            periodoAtivo: filtro.periodoAtivo,
            ordenarPor: filtro.ordenarPor,
            nomeClienteExtrato,
            clienteIdExtrato,
            lancamentos: lancamentosAtivos as LancamentoContasReceber[],
            trabalhos: trabalhosAtivos,
            parcelasSomenteAReceber: filtro.parcelasSomenteAReceber,
            parcelasAgruparPorCliente: filtro.parcelasAgruparPorCliente,
            recebimentosAgruparPorCliente: filtro.recebimentosAgruparPorCliente,
          }
        ),
      modeloLabel,
      "relatorio-receitas.pdf",
      { janela, origem: "Financeiro · Extrato receitas" }
    )
      .catch(() => {
        janela?.close();
        alert("Não foi possível gerar o PDF. Permita pop-ups para abrir em nova aba.");
      })
      .finally(() => setGerandoPdf(false));
  }

  if (!open) return null;

  return (
    <I18nPortal>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
        <div
          className="absolute inset-0 bg-black/40"
          onClick={onClose}
          aria-hidden
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="relatorio-receitas-titulo"
          className="relative w-full max-w-[920px] rounded-sm bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3.5">
            <h2
              id="relatorio-receitas-titulo"
              className="text-[15px] font-medium text-slate-700"
            >
              Relatório Receitas
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-5 px-6 py-5">
            <div className="grid grid-cols-2 gap-6">
              <div className="min-w-0">
                <label className={labelClass}>Modelo Relatório</label>
                <select
                  value={modelo}
                  onChange={(e) => {
                    const valor = e.target.value as ModeloRelatorioReceitas;
                    setModelo(valor);
                    if (modeloEhExtratoPorCliente(valor) && cliente === "todos") {
                      setCliente("");
                    }
                    if (modeloEhParcelasAReceber(valor)) {
                      setPeriodoCampo("vencimento");
                      setParcelasSomenteAReceber(true);
                    }
                    if (valor === "parcelas-a-receber-modelo-2") {
                      setParcelasAgruparPorCliente(true);
                    }
                    if (valor === "recebimentos") {
                      setPeriodoCampo("vencimento");
                      setRecebimentosAgruparPorCliente(true);
                    }
                  }}
                  className={selectClass}
                >
                  {MODELOS_RELATORIO_RECEITAS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <label className={labelClass}>Ordenar Por</label>
                <select
                  value={
                    modelo === "parcelas-a-receber-modelo-1" ? "nao_disponivel" : ordenarPor
                  }
                  onChange={(e) =>
                    setOrdenarPor(
                      e.target.value as FiltroRelatorioContasReceber["ordenarPor"]
                    )
                  }
                  disabled={modelo === "parcelas-a-receber-modelo-1"}
                  className={selectClass}
                >
                  {modelo === "parcelas-a-receber-modelo-1" ? (
                    <option value="nao_disponivel">Não disponível</option>
                  ) : (
                    <>
                      <option value="data_lancamento">Data Lançamento</option>
                      <option value="vencimento">Data Vencimento</option>
                      <option value="cliente">Cliente</option>
                      <option value="valor">Valor</option>
                      <option value="fatura">Nº Fatura</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {(modelo === "parcelas-a-receber-modelo-2" || modelo === "recebimentos") && (
              <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
                {modelo === "parcelas-a-receber-modelo-2" && (
                  <label className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-700">
                    <input
                      type="checkbox"
                      checked={parcelasSomenteAReceber}
                      onChange={(e) => setParcelasSomenteAReceber(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-[#4a90d9] focus:ring-[#4a90d9]"
                    />
                    Mostrar somente a receber
                  </label>
                )}
                {(modelo === "parcelas-a-receber-modelo-2" || modelo === "recebimentos") && (
                  <label className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-700">
                    <input
                      type="checkbox"
                      checked={
                        modelo === "recebimentos"
                          ? recebimentosAgruparPorCliente
                          : parcelasAgruparPorCliente
                      }
                      onChange={(e) => {
                        if (modelo === "recebimentos") {
                          setRecebimentosAgruparPorCliente(e.target.checked);
                        } else {
                          setParcelasAgruparPorCliente(e.target.checked);
                        }
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-[#4a90d9] focus:ring-[#4a90d9]"
                    />
                    Agrupar por cliente
                  </label>
                )}
              </div>
            )}

            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-6">
              <div className="min-w-0">
                <SelectPesquisavel
                  label={
                    <>
                      Clientes
                      {extratoExigeCliente ? (
                        <span className="ml-1 text-red-500">*</span>
                      ) : null}
                    </>
                  }
                  value={extratoExigeCliente && cliente === "todos" ? "" : cliente}
                  onChange={setCliente}
                  required={extratoExigeCliente}
                  placeholder={
                    extratoExigeCliente && clientesNoSelect.length > 0
                      ? "Selecione um cliente"
                      : extratoExigeCliente && !clientesNoSelect.length
                        ? "Nenhum cliente disponível"
                        : "Todos"
                  }
                  disabled={extratoExigeCliente && !clientesNoSelect.length}
                  inputClassName={cn(
                    selectClass,
                    extratoExigeCliente && (!cliente || cliente === "todos")
                      ? "border-amber-400 focus:border-amber-500 focus:ring-amber-500"
                      : ""
                  )}
                  menuEmPortal
                  options={clientesNoSelect.map((c) => ({
                    value: c,
                    label: c === "todos" ? "Todos" : c,
                  }))}
                />
                {extratoExigeCliente ? (
                  <p className="mt-1 text-[11px] text-amber-700">
                    Obrigatório escolher um cliente para o extrato.
                  </p>
                ) : null}
                {modelo === "parcelas-a-receber-modelo-1" && (
                  <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-[13px] text-slate-700">
                    <input
                      type="checkbox"
                      checked={parcelasSomenteAReceber}
                      onChange={(e) => setParcelasSomenteAReceber(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-[#4a90d9] focus:ring-[#4a90d9]"
                    />
                    Mostrar somente a receber
                  </label>
                )}
                <button
                  type="button"
                  onClick={imprimir}
                  disabled={
                    gerandoPdf ||
                    (extratoExigeCliente && (!cliente || cliente === "todos"))
                  }
                  title="Visualizar relatório em PDF"
                  className="mt-2.5 flex h-[34px] w-[34px] items-center justify-center rounded border border-[#4a90d9] bg-white text-[#4a90d9] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FileText className="h-4 w-4" />
                </button>
              </div>

              <div className="min-w-0">
                <label className={labelClass}>Período</label>
                <div className="flex h-[34px] w-full items-stretch gap-1.5">
                  <select
                    value={periodoCampo}
                    onChange={(e) =>
                      setPeriodoCampo(
                        e.target.value as FiltroRelatorioContasReceber["periodoCampo"]
                      )
                    }
                    className="h-full w-[11.25rem] shrink-0 rounded border border-slate-300 bg-white px-2 text-[13px] text-slate-800 outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]"
                  >
                    <option value="data_lancamento">Data Lançamento</option>
                    <option value="vencimento">Data Vencimento</option>
                  </select>
                  <label className="flex w-6 shrink-0 items-center justify-center">
                    <input
                      type="checkbox"
                      checked={periodoAtivo}
                      onChange={(e) => setPeriodoAtivo(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-[#4a90d9] focus:ring-[#4a90d9]"
                      aria-label="Filtrar por período"
                    />
                  </label>
                  <CampoDataBr
                    value={dataInicio}
                    onChange={setDataInicio}
                    disabled={!periodoAtivo}
                    iconPosition="left"
                    className="h-[34px] min-w-[8rem] flex-1 space-y-0 [&>div]:h-full"
                    inputClassName={inputDataClass}
                  />
                  <CampoDataBr
                    value={dataFinal}
                    onChange={setDataFinal}
                    disabled={!periodoAtivo}
                    iconPosition="left"
                    className="h-[34px] min-w-[8rem] flex-1 space-y-0 [&>div]:h-full"
                    inputClassName={inputDataClass}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              {extratoExigeCliente ? (
                <BotoesExtratoCompartilhar
                  onExcel={exportarExtratoExcel}
                  onWhatsapp={() => {
                    if (!extratoPronto()) {
                      alert("Selecione um cliente para enviar o extrato.");
                      return;
                    }
                    setWhatsappExtratoAberto(true);
                  }}
                  disabled={!extratoPronto()}
                  processando={gerandoPdf}
                />
              ) : null}

              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={imprimir}
                  disabled={
                    gerandoPdf ||
                    (extratoExigeCliente && (!cliente || cliente === "todos"))
                  }
                  className="h-11 rounded-sm bg-[#4a90d9] text-sm font-normal text-white hover:bg-[#3d7fc4] disabled:opacity-60"
                >
                  {gerandoPdf ? "Gerando PDF..." : "Imprimir"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-11 rounded-sm border border-slate-500 bg-white text-sm font-normal text-slate-700 hover:bg-slate-50"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>

        {clienteExtratoSelecionado ? (
          <EnviarExtratoWhatsappModal
            open={whatsappExtratoAberto}
            onClose={() => setWhatsappExtratoAberto(false)}
            clienteNome={clienteExtratoSelecionado.nome}
            telefoneInicial={clienteExtratoSelecionado.celular}
            gerarPdf={gerarPdfExtrato}
          />
        ) : null}
    </div>
    </I18nPortal>
  );
}
