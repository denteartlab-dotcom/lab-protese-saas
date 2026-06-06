"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Barcode, Minus, Plus, Upload } from "lucide-react";
import {
  AnexosReciboCampo,
  type AnexosReciboCampoRef,
} from "@/components/financeiro/AnexosReciboCampo";
import {
  ANEXOS_FINANCEIRO_VAZIOS,
  carregarEntidadesDespesaLocal,
  labelNomeEntidadeDespesa,
  TIPOS_FORNECEDOR_DESPESA,
  type AnexoDespesa,
  type EntidadeDespesa,
} from "@/lib/lancamento-despesa";
import { CampoDataBr } from "@/components/ui";
import { dateToBrShort } from "@/lib/datas-br";
import { parseNotaFiscalArquivo } from "@/lib/nfe-import";
import {
  encontrarFornecedorPorNfe,
  formatMoneyBrNfe,
  formatQuantidadeNfe,
  lerFornecedoresComCnpj,
} from "@/lib/nfe-xml";
import { PlanoContasCategoriaSelect } from "@/components/financeiro/PlanoContasCategoriaSelect";
import {
  carregarPlanoContas,
  categoriaPadraoLancamento,
} from "@/lib/plano-contas";
import { cn } from "@/lib/utils";

export type ItemReceitaLinha = {
  id: string;
  produto: string;
  descricao: string;
  quantidade: string;
  custoUnitario: string;
};

export type ParcelaReceitaLinha = {
  parcela: string;
  formaPagamento: string;
  conta: string;
  vencimento: string;
  codigoBarrasPix: string;
  valor: string;
  pago: boolean;
};

export type LancarReceitaPayload = {
  clienteId: string;
  entidadeNome?: string;
  tipoCliente: string;
  categoria: string;
  dataLancamento: string;
  notaFiscalRef: string;
  receitaFixa: boolean;
  itens: ItemReceitaLinha[];
  parcelas: ParcelaReceitaLinha[];
  descontoTipo: "percentual" | "valor";
  desconto: string;
  observacoes: string;
  valorBruto: number;
  totalLiquido: number;
  anexos?: AnexoDespesa[];
};

export type ModoLancamento = "receita" | "despesa";

type ClienteOpt = { id: string; nome: string };

const labelClass = "mb-1 block text-[11px] font-medium text-slate-600";
const inputClass =
  "h-9 w-full rounded border border-slate-300 bg-white px-2.5 text-[12px] text-slate-800 outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]";
const selectClass = inputClass;

function novoItem(): ItemReceitaLinha {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    produto: "",
    descricao: "",
    quantidade: "1",
    custoUnitario: "0,00",
  };
}

function parseMoney(value: string) {
  return (
    Number(
      value
        .replace(/[^\d,.-]/g, "")
        .replace(/\./g, "")
        .replace(",", ".")
    ) || 0
  );
}

function formatMoneyInput(value: string) {
  const amount = Number(value.replace(/\D/g, "")) / 100;
  return amount.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: LancarReceitaPayload) => void | Promise<void>;
  /** Clientes (receita) ou fornecedores (despesa). */
  entidades: ClienteOpt[];
  modo?: ModoLancamento;
  salvando?: boolean;
  tituloEdicao?: string;
  /** Arquivos já salvos (edição). */
  anexosIniciais?: AnexoDespesa[];
};

const cfgModo = {
  receita: {
    titulo: "Lançar Receita",
    tipo: "Tipo Cliente",
    nome: "Nome do Cliente",
    fixa: "Receita Fixa",
    tipoPadrao: "cliente",
    categoriaPadrao: "Receitas de Serviços",
    dataModal: "lancar-receita-smart",
    tiposEntidade: [
      { value: "cliente", label: "Cliente" },
      { value: "particular", label: "Particular" },
      { value: "convenio", label: "Convênio" },
    ],
  },
  despesa: {
    titulo: "Lançar Despesa",
    tipo: "Tipo Fornecedor",
    nome: "Nome do Fornecedor",
    fixa: "Despesa Fixa",
    tipoPadrao: "fornecedores",
    categoriaPadrao: "Guia de Simples Nacional",
    dataModal: "lancar-despesa-smart",
    tiposEntidade: TIPOS_FORNECEDOR_DESPESA,
  },
} as const;

export function LancarReceitaModal({
  open,
  onClose,
  onSubmit,
  entidades,
  modo = "receita",
  salvando = false,
  tituloEdicao,
  anexosIniciais = ANEXOS_FINANCEIRO_VAZIOS,
}: Props) {
  const cfg = cfgModo[modo];
  const secaoPlano = modo === "receita" ? "receitas" : "despesas";
  const [tipoCliente, setTipoCliente] = useState<string>(cfg.tipoPadrao);
  const [clienteId, setClienteId] = useState("");
  const [categoria, setCategoria] = useState<string>(cfg.categoriaPadrao);
  const [dataLancamento, setDataLancamento] = useState(dateToBrShort(new Date()));
  const [notaFiscalRef, setNotaFiscalRef] = useState("");
  const [receitaFixa, setReceitaFixa] = useState(false);
  const [itens, setItens] = useState<ItemReceitaLinha[]>([novoItem()]);
  const [codigoBarras, setCodigoBarras] = useState("");
  const [descontoTipo, setDescontoTipo] = useState<"percentual" | "valor">("percentual");
  const [desconto, setDesconto] = useState("0,00");
  const [numParcelas, setNumParcelas] = useState(1);
  const [parcelas, setParcelas] = useState<ParcelaReceitaLinha[]>([
    {
      parcela: "1/1",
      formaPagamento: "",
      conta: "Caixa Principal",
      vencimento: dateToBrShort(new Date()),
      codigoBarrasPix: "",
      valor: "0,00",
      pago: false,
    },
  ]);
  const [observacoes, setObservacoes] = useState("");
  const [arquivoNota, setArquivoNota] = useState<File | null>(null);
  const [parseandoNota, setParseandoNota] = useState(false);
  const [feedbackNota, setFeedbackNota] = useState<{
    tipo: "ok" | "erro";
    texto: string;
  } | null>(null);
  const [portalPronto, setPortalPronto] = useState(false);
  const [entidadesDespesa, setEntidadesDespesa] = useState<ClienteOpt[]>([]);
  const [cadastrando, setCadastrando] = useState(false);
  const submitLockRef = useRef(false);
  const anexosRef = useRef<AnexosReciboCampoRef>(null);
  const ocupado = cadastrando || salvando;
  const pastaAnexos = modo === "despesa" ? "despesas" : "receitas";

  useEffect(() => {
    setPortalPronto(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setTipoCliente(cfg.tipoPadrao);
    setClienteId("");
    const plano = carregarPlanoContas();
    setCategoria(
      categoriaPadraoLancamento(plano, secaoPlano) || cfg.categoriaPadrao
    );
    setDataLancamento(dateToBrShort(new Date()));
    setNotaFiscalRef("");
    setReceitaFixa(false);
    setItens([novoItem()]);
    setCodigoBarras("");
    setDescontoTipo("percentual");
    setDesconto("0,00");
    setNumParcelas(1);
    setObservacoes("");
    setArquivoNota(null);
    setParseandoNota(false);
    setFeedbackNota(null);
  }, [open, cfg.tipoPadrao, cfg.categoriaPadrao, secaoPlano, modo]);

  useEffect(() => {
    if (!open || modo !== "despesa") return;
    setClienteId("");
    let cancelado = false;

    async function carregarEntidades() {
      if (tipoCliente === "clientes") {
        try {
          const res = await fetch("/api/clientes");
          const data = await res.json();
          if (cancelado) return;
          const lista = Array.isArray(data)
            ? data
                .map((item: { id?: string; nome?: string }) => ({
                  id: String(item.id || ""),
                  nome: String(item.nome || "").trim(),
                }))
                .filter((item) => item.id && item.nome)
            : [];
          setEntidadesDespesa(lista);
        } catch {
          if (!cancelado) setEntidadesDespesa([]);
        }
        return;
      }

      const tipo = tipoCliente as Exclude<EntidadeDespesa, "todos">;
      if (!cancelado) {
        setEntidadesDespesa(carregarEntidadesDespesaLocal(tipo));
      }
    }

    void carregarEntidades();
    return () => {
      cancelado = true;
    };
  }, [open, modo, tipoCliente]);

  const entidadesLista = modo === "despesa" ? entidadesDespesa : entidades;
  const labelNomeEntidade =
    modo === "despesa" ? labelNomeEntidadeDespesa(tipoCliente) : cfg.nome;

  async function importarArquivoNotaFiscal(file: File | null) {
    setArquivoNota(file);
    setFeedbackNota(null);
    if (!file) return;

    setParseandoNota(true);
    try {
      const dados = await parseNotaFiscalArquivo(file);

      setNotaFiscalRef(dados.referencia);
      setDataLancamento(dados.dataEmissao);

      let fornecedorVinculado = "";
      if (modo === "despesa") {
        setTipoCliente("fornecedores");
        const cadastro = lerFornecedoresComCnpj();
        const listaMatch =
          cadastro.length > 0
            ? cadastro
            : carregarEntidadesDespesaLocal("fornecedores").map((e) => ({
                id: e.id,
                nome: e.nome,
              }));
        fornecedorVinculado = encontrarFornecedorPorNfe(
          dados.emitenteNome,
          dados.emitenteCnpj,
          listaMatch
        );
        if (fornecedorVinculado) {
          setClienteId(fornecedorVinculado);
        }
      }

      setItens(
        dados.itens.map((item) => ({
          id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          produto: item.produto,
          descricao: item.descricao,
          quantidade: formatQuantidadeNfe(item.quantidade),
          custoUnitario: formatMoneyBrNfe(item.valorUnitario),
        }))
      );

      const emitenteInfo = [
        dados.emitenteNome,
        dados.emitenteCnpj ? `CNPJ ${dados.emitenteCnpj}` : "",
      ]
        .filter(Boolean)
        .join(" — ");

      if (!fornecedorVinculado && modo === "despesa" && emitenteInfo) {
        setObservacoes((atual) => {
          const prefixo = `Emitente NF-e: ${emitenteInfo}`;
          return atual.trim() ? `${prefixo}\n${atual}` : prefixo;
        });
      }

      const tipoArquivo = file.name.toLowerCase().endsWith(".pdf") ? "PDF" : "XML";
      setFeedbackNota({
        tipo: "ok",
        texto: fornecedorVinculado
          ? `NF-e (${tipoArquivo}) importada. Fornecedor e ${dados.itens.length} item(ns) preenchidos.`
          : `NF-e (${tipoArquivo}) importada. Valor e itens preenchidos.${emitenteInfo ? " Vincule o fornecedor manualmente." : ""}`,
      });
    } catch (err) {
      setFeedbackNota({
        tipo: "erro",
        texto:
          err instanceof Error
            ? err.message
            : "Não foi possível ler a nota fiscal.",
      });
    } finally {
      setParseandoNota(false);
    }
  }

  const valorBruto = useMemo(
    () =>
      itens.reduce((sum, item) => {
        const qtd = Number(item.quantidade.replace(",", ".")) || 0;
        return sum + parseMoney(item.custoUnitario) * qtd;
      }, 0),
    [itens]
  );

  const descontoValor = useMemo(() => {
    const base = parseMoney(desconto);
    if (descontoTipo === "valor") return base;
    return valorBruto * (Math.min(Math.max(base, 0), 100) / 100);
  }, [desconto, descontoTipo, valorBruto]);

  const totalLiquido = Math.max(0, valorBruto - descontoValor);

  useEffect(() => {
    if (!open) return;
    setDataLancamento(dateToBrShort(new Date()));
  }, [open]);

  useEffect(() => {
    const valorParcela = numParcelas > 0 ? totalLiquido / numParcelas : 0;
    setParcelas((atual) => {
      return Array.from({ length: numParcelas }, (_, i) => {
        const existente = atual[i];
        return {
          parcela: `${i + 1}/${numParcelas}`,
          formaPagamento: existente?.formaPagamento ?? "",
          conta: existente?.conta ?? "Caixa Principal",
          vencimento: existente?.vencimento ?? dateToBrShort(new Date()),
          codigoBarrasPix: existente?.codigoBarrasPix ?? "",
          valor: money(valorParcela),
          pago: existente?.pago ?? false,
        };
      });
    });
  }, [numParcelas, totalLiquido]);

  function atualizarItem(id: string, patch: Partial<ItemReceitaLinha>) {
    setItens((lista) =>
      lista.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  function subtotalItem(item: ItemReceitaLinha) {
    const qtd = Number(item.quantidade.replace(",", ".")) || 0;
    return parseMoney(item.custoUnitario) * qtd;
  }

  function atualizarParcela(index: number, patch: Partial<ParcelaReceitaLinha>) {
    setParcelas((lista) =>
      lista.map((p, i) => (i === index ? { ...p, ...patch } : p))
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitLockRef.current || ocupado) return;
    submitLockRef.current = true;
    setCadastrando(true);
    try {
      let anexos: AnexoDespesa[] | undefined;
      const lista = await anexosRef.current?.resolverAnexos();
      if (lista?.length) anexos = lista;
      const selecionada = entidadesLista.find((item) => item.id === clienteId);
      await onSubmit({
        clienteId,
        entidadeNome: selecionada?.nome || clienteId,
        tipoCliente,
        categoria,
        dataLancamento,
        notaFiscalRef,
        receitaFixa,
        itens,
        parcelas,
        descontoTipo,
        desconto,
        observacoes,
        valorBruto,
        totalLiquido,
        anexos,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Falha ao enviar os arquivos.");
    } finally {
      submitLockRef.current = false;
      setCadastrando(false);
    }
  }

  if (!open || !portalPronto) return null;

  const conteudo = (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-8"
      data-modal={cfg.dataModal}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lancar-receita-titulo"
    >
      <div
        className="absolute inset-0"
        onClick={() => {
          if (!ocupado) onClose();
        }}
        aria-hidden
      />
      <div className="relative my-auto flex w-full max-w-[1060px] flex-col rounded border border-slate-200 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
          <h2 id="lancar-receita-titulo" className="text-[14px] font-normal text-slate-800">
            {tituloEdicao || cfg.titulo}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-lg text-slate-400 hover:text-slate-600"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="max-h-[calc(100vh-6rem)] overflow-y-auto px-4 py-3 text-[11px] text-slate-700"
        >
          <div className="grid grid-cols-12 items-end gap-x-3 gap-y-2">
            <div className="col-span-12 md:col-span-5">
              <label className={labelClass}>
                Nota fiscal — XML ou PDF (opcional)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={
                    parseandoNota
                      ? "Lendo nota fiscal…"
                      : arquivoNota?.name || ""
                  }
                  placeholder="Selecione XML ou PDF da NF-e"
                  className={cn(inputClass, "min-w-0 flex-1 bg-slate-50")}
                />
                <label
                  className={cn(
                    "inline-flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded border border-[#4a90d9] bg-white px-3 text-[12px] text-[#4a90d9] hover:bg-[#f0f7ff]",
                    parseandoNota && "pointer-events-none opacity-60"
                  )}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {parseandoNota ? "Lendo…" : "Upload"}
                  <input
                    type="file"
                    accept=".xml,.nfe,.pdf,application/xml,text/xml,application/pdf"
                    className="sr-only"
                    disabled={parseandoNota}
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      void importarArquivoNotaFiscal(file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              {feedbackNota ? (
                <p
                  className={cn(
                    "mt-1 text-[10px]",
                    feedbackNota.tipo === "ok"
                      ? "text-emerald-600"
                      : "text-red-600"
                  )}
                >
                  {feedbackNota.texto}
                </p>
              ) : null}
            </div>
            <div className="col-span-6 md:col-span-2">
              <label className={labelClass}>Data de Lançamento</label>
              <CampoDataBr
                value={dataLancamento}
                onChange={setDataLancamento}
                className="space-y-0"
                inputClassName={inputClass}
              />
            </div>
            <div className="col-span-6 md:col-span-3">
              <label className={labelClass}>Nota Fiscal Referência</label>
              <input
                type="text"
                value={notaFiscalRef}
                onChange={(e) => setNotaFiscalRef(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="col-span-12 flex items-center justify-end gap-2 md:col-span-2 md:pb-0.5">
              <span className="text-[11px] text-slate-600">{cfg.fixa}</span>
              <button
                type="button"
                role="switch"
                aria-checked={receitaFixa}
                onClick={() => setReceitaFixa((v) => !v)}
                className={cn(
                  "relative h-5 w-9 shrink-0 rounded-full transition",
                  receitaFixa ? "bg-[#4a90d9]" : "bg-slate-300"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
                    receitaFixa ? "left-[18px]" : "left-0.5"
                  )}
                />
              </button>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-12 gap-3">
            <div className="col-span-12 md:col-span-3">
              <label className={labelClass}>{cfg.tipo}</label>
              <select
                value={tipoCliente}
                onChange={(e) => {
                  setTipoCliente(e.target.value);
                  setClienteId("");
                }}
                className={selectClass}
              >
                {cfg.tiposEntidade.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-12 md:col-span-6">
              <label className={labelClass}>{labelNomeEntidade}</label>
              <select
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                className={selectClass}
                required={modo === "receita"}
              >
                <option value="">Selecione</option>
                {entidadesLista.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-12 md:col-span-3">
              <label className={labelClass}>Categoria</label>
              <PlanoContasCategoriaSelect
                secao={secaoPlano}
                value={categoria}
                onChange={setCategoria}
                triggerClassName={selectClass}
                menuEmPortal
                required
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Barcode className="h-5 w-5 text-slate-500" />
            <input
              type="text"
              value={codigoBarras}
              onChange={(e) => setCodigoBarras(e.target.value)}
              placeholder="Leitor de Código de Barras"
              className={cn(inputClass, "max-w-md")}
            />
          </div>

          <div className="mt-2 overflow-x-auto rounded border border-slate-200">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="bg-[#f5f6f8] text-[10px] font-semibold uppercase text-slate-500">
                  <th className="px-3 py-2 text-left">Produto</th>
                  <th className="px-3 py-2 text-left">Descrição</th>
                  <th className="px-3 py-2 text-center w-24">Quantidade</th>
                  <th className="px-3 py-2 text-right w-28">Custo Unitário</th>
                  <th className="px-3 py-2 text-right w-28">Subtotal</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {itens.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={item.produto}
                        onChange={(e) =>
                          atualizarItem(item.id, { produto: e.target.value })
                        }
                        className={inputClass}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={item.descricao}
                        onChange={(e) =>
                          atualizarItem(item.id, { descricao: e.target.value })
                        }
                        className={inputClass}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={item.quantidade}
                        onChange={(e) =>
                          atualizarItem(item.id, { quantidade: e.target.value })
                        }
                        className={cn(inputClass, "text-center")}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={item.custoUnitario}
                        onChange={(e) =>
                          atualizarItem(item.id, {
                            custoUnitario: formatMoneyInput(e.target.value),
                          })
                        }
                        className={cn(inputClass, "text-right")}
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-slate-800">
                      {money(subtotalItem(item))}
                    </td>
                    <td className="px-1 py-1.5">
                      {itens.length > 1 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setItens((lista) =>
                              lista.filter((i) => i.id !== item.id)
                            )
                          }
                          className="text-slate-400 hover:text-red-500"
                        >
                          ✕
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
            <button
              type="button"
              onClick={() => setItens((lista) => [...lista, novoItem()])}
              className="inline-flex items-center gap-1.5 rounded border border-[#4cae4c] bg-[#4cae4c] px-3 py-1.5 text-[12px] font-normal text-white hover:bg-[#449d44]"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar Item
            </button>
            <div className="w-full max-w-xs space-y-2 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Valor Total</span>
                <span className="font-medium text-slate-800">{money(valorBruto)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-600">Desconto</span>
                <div className="flex items-center gap-1">
                  <select
                    value={descontoTipo}
                    onChange={(e) =>
                      setDescontoTipo(e.target.value as "percentual" | "valor")
                    }
                    className="h-8 w-12 rounded border border-slate-300 text-center text-[11px]"
                  >
                    <option value="percentual">%</option>
                    <option value="valor">=</option>
                  </select>
                  <input
                    type="text"
                    value={desconto}
                    onChange={(e) =>
                      setDesconto(
                        descontoTipo === "valor"
                          ? formatMoneyInput(e.target.value)
                          : e.target.value.replace(/[^\d,.]/g, "")
                      )
                    }
                    className={cn(inputClass, "h-8 w-24 text-right")}
                  />
                  <span className="text-slate-500">{money(descontoValor)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                <span className="font-semibold text-[#4a90d9]">Total Líquido</span>
                <span className="text-[15px] font-bold text-[#4a90d9]">
                  {money(totalLiquido)}
                </span>
              </div>
            </div>
          </div>

          <p className="mt-6 text-center text-[12px] text-slate-500">
            Escolha a(s) forma(s) de pagamento
          </p>

          <div className="mt-2 flex items-center gap-2">
            <span className="text-[11px] text-slate-600">Parcelas</span>
            <button
              type="button"
              onClick={() => setNumParcelas((n) => Math.max(1, n - 1))}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <input
              type="text"
              readOnly
              value={String(numParcelas)}
              className={cn(inputClass, "h-7 w-12 text-center")}
            />
            <button
              type="button"
              onClick={() => setNumParcelas((n) => Math.min(24, n + 1))}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-2 overflow-x-auto rounded border border-slate-200">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr className="bg-[#f5f6f8] text-[10px] font-semibold uppercase text-slate-500">
                  <th className="px-2 py-2 text-left w-16">Parcela</th>
                  <th className="px-2 py-2 text-left">Forma Pagamento</th>
                  <th className="px-2 py-2 text-left">Conta</th>
                  <th className="px-2 py-2 text-left">Vencimento</th>
                  <th className="px-2 py-2 text-left">Cod. Barras / Pix</th>
                  <th className="px-2 py-2 text-right w-24">Valor</th>
                  <th className="px-2 py-2 text-center w-14">Pago</th>
                </tr>
              </thead>
              <tbody>
                {parcelas.map((parcela, index) => (
                  <tr key={index} className="border-t border-slate-100">
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        readOnly
                        value={parcela.parcela}
                        className={cn(inputClass, "bg-slate-50 text-center")}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={parcela.formaPagamento}
                        onChange={(e) =>
                          atualizarParcela(index, {
                            formaPagamento: e.target.value,
                          })
                        }
                        className={selectClass}
                      >
                        <option value="">Selecione</option>
                        <option value="Pix">Pix</option>
                        <option value="Dinheiro">Dinheiro</option>
                        <option value="Cartão">Cartão</option>
                        <option value="Boleto">Boleto</option>
                        <option value="Transferência">Transferência</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={parcela.conta}
                        onChange={(e) =>
                          atualizarParcela(index, { conta: e.target.value })
                        }
                        className={selectClass}
                      >
                        <option>Caixa Principal</option>
                        <option>Conta Bancária</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <CampoDataBr
                        value={parcela.vencimento}
                        onChange={(v) => atualizarParcela(index, { vencimento: v })}
                        className="space-y-0"
                        inputClassName={inputClass}
                        calendarPosition="relative"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={parcela.codigoBarrasPix}
                        onChange={(e) =>
                          atualizarParcela(index, {
                            codigoBarrasPix: e.target.value,
                          })
                        }
                        placeholder="Digite o código ou Pix..."
                        className={inputClass}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={parcela.valor}
                        onChange={(e) =>
                          atualizarParcela(index, {
                            valor: formatMoneyInput(e.target.value),
                          })
                        }
                        className={cn(inputClass, "text-right")}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={parcela.pago}
                        onClick={() =>
                          atualizarParcela(index, { pago: !parcela.pago })
                        }
                        className={cn(
                          "relative mx-auto inline-flex h-5 w-9 rounded-full transition",
                          parcela.pago ? "bg-[#4a90d9]" : "bg-slate-300"
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
                            parcela.pago ? "left-[18px]" : "left-0.5"
                          )}
                        />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <label className={labelClass}>Observações</label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={4}
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-[12px] outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]"
            />
          </div>

          <AnexosReciboCampo
            ref={anexosRef}
            pasta={pastaAnexos}
            anexosIniciais={anexosIniciais}
            className="mt-4"
          />

          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
            <button
              type="submit"
              disabled={
                ocupado ||
                totalLiquido <= 0 ||
                (modo === "receita" && !clienteId)
              }
              className="h-10 rounded bg-[#4a90d9] text-[13px] font-normal text-white hover:bg-[#3d7fc4] disabled:cursor-wait disabled:opacity-60"
            >
              {ocupado ? "Cadastrando…" : "Cadastrar"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={ocupado}
              className="h-10 rounded border border-slate-300 bg-white text-[13px] font-normal text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Fechar
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(conteudo, document.body);
}

/** Alias para Contas a Pagar. */
export function LancarDespesaModal(
  props: Omit<Props, "modo"> & { modo?: never }
) {
  return <LancarReceitaModal {...props} modo="despesa" />;
}
