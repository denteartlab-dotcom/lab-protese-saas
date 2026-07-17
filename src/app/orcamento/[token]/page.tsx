"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  FileSpreadsheet,
  ImagePlus,
  Plus,
  Printer,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  calcularTotaisItens,
  totalLiquidoOrcamento,
  type ItemOrcamento,
  type Orcamento,
} from "@/lib/orcamentos-types";
import { propsInputComSelecaoAoFocar } from "@/lib/input-selecao";
import {
  exigeParcelamento,
  itemOrcamentoLinhaNova,
  normalizarParcelas,
  parseCondicoesPagamento,
  rotuloCondicoesPagamento,
  type FormaPagamentoOrcamento,
} from "@/lib/orcamentos-pagamento";
import { formatCurrency, formatDate } from "@/lib/utils";
import { fetchPortalPublico } from "@/lib/portal-publico-cliente";
import type { PortalPublicoPaginaOrcamento } from "@/lib/portal-publico-types";

function parseMoeda(value: string) {
  return Number(value.replace(/\D/g, "")) / 100;
}

function formatMoedaInput(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatTelefone(raw?: string) {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return raw || "";
}

/** Imagens de upload no link público passam pelo proxy autenticado pelo token. */
function urlImagemOrcamentoPublico(token: string, imagemUrl?: string) {
  const u = imagemUrl?.trim();
  if (!u) return "";
  if (u.startsWith("data:") || u.startsWith("blob:")) return u;
  if (
    u.startsWith("/uploads/") ||
    u.startsWith("/api/uploads/disco/") ||
    u.startsWith("/api/uploads/arquivo/")
  ) {
    return `/api/orcamentos/public/${encodeURIComponent(token)}/arquivo?u=${encodeURIComponent(u)}`;
  }
  return u;
}

export default function OrcamentoPublicoPage() {
  const params = useParams();
  const token = String(params.token || "");

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [orcamento, setOrcamento] = useState<Orcamento | null>(null);
  const [itens, setItens] = useState<ItemOrcamento[]>([]);
  const [descontoPercentual, setDescontoPercentual] = useState(0);
  const [descontoValor, setDescontoValor] = useState("R$ 0,00");
  const [tipoDesconto, setTipoDesconto] = useState<"percentual" | "valor">("percentual");
  const [observacao, setObservacao] = useState("");
  const [formaPagamento, setFormaPagamento] =
    useState<FormaPagamentoOrcamento>("a_vista");
  const [parcelas, setParcelas] = useState(1);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [fotoModalIndex, setFotoModalIndex] = useState<number | null>(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState("");
  const inputFotoRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetchPortalPublico<PortalPublicoPaginaOrcamento>("orcamento", token);
      if (!res.ok) {
        setErro(res.message || res.error || "Link indisponível.");
        setOrcamento(null);
        return;
      }
      const data = res.dados.entidade;
      setOrcamento(data);
      setItens(data.itens || []);
      setObservacao(data.observacoes || "");
      const cond = parseCondicoesPagamento(data.condicoesPagamento);
      setFormaPagamento(cond.forma);
      setParcelas(cond.parcelas);
      setDescontoPercentual(data.descontoPercentual || 0);
      setDescontoValor(formatMoedaInput(data.desconto || 0));
      setEnviado(
        data.status === "enviado" ||
          data.status === "aprovado" ||
          data.status === "cancelado"
      );
    } catch {
      setErro("Não foi possível carregar o orçamento.");
    } finally {
      setCarregando(false);
    }
  }, [token]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const subtotal = useMemo(() => calcularTotaisItens(itens), [itens]);
  const totalLiquido = useMemo(() => {
    if (tipoDesconto === "percentual") {
      return totalLiquidoOrcamento(subtotal, 0, descontoPercentual);
    }
    return totalLiquidoOrcamento(subtotal, parseMoeda(descontoValor), 0);
  }, [subtotal, descontoPercentual, descontoValor, tipoDesconto]);

  function atualizarItem<K extends keyof ItemOrcamento>(
    index: number,
    campo: K,
    valor: ItemOrcamento[K]
  ) {
    setItens((atual) =>
      atual.map((item, i) => (i === index ? { ...item, [campo]: valor } : item))
    );
  }

  function atualizarValorUnitario(index: number, texto: string) {
    atualizarItem(index, "valorUnitario", parseMoeda(texto));
  }

  function adicionarLinhaProduto() {
    setItens((atual) => [...atual, itemOrcamentoLinhaNova()]);
  }

  const todosSelecionados =
    itens.length > 0 && selecionados.size === itens.length;
  const algunsSelecionados =
    selecionados.size > 0 && selecionados.size < itens.length;

  function toggleSelecionar(index: number) {
    setSelecionados((atual) => {
      const next = new Set(atual);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleSelecionarTodos() {
    if (todosSelecionados) {
      setSelecionados(new Set());
      return;
    }
    setSelecionados(new Set(itens.map((_, i) => i)));
  }

  function reindexarSelecionados(indicesRemovidos: number[]) {
    const removidos = new Set(indicesRemovidos);
    setSelecionados((atual) => {
      const next = new Set<number>();
      for (const idx of atual) {
        if (removidos.has(idx)) continue;
        let novo = idx;
        for (const r of indicesRemovidos) {
          if (r < idx) novo -= 1;
        }
        if (novo >= 0) next.add(novo);
      }
      return next;
    });
  }

  function excluirLinhas(indices: number[]) {
    if (indices.length === 0) return;
    if (itens.length - indices.length < 1) {
      alert("O orçamento precisa ter pelo menos um produto.");
      return;
    }
    const remover = new Set(indices);
    setItens((atual) => atual.filter((_, i) => !remover.has(i)));
    reindexarSelecionados(indices);
  }

  function excluirLinha(index: number) {
    excluirLinhas([index]);
  }

  function excluirSelecionados() {
    excluirLinhas(Array.from(selecionados).sort((a, b) => b - a));
  }

  const inputCelula =
    "h-8 w-full min-w-0 rounded-sm border border-slate-200 px-2 text-[10px] disabled:bg-slate-50";

  function exportarExcel() {
    const linhas = [
      ["Cod Barras", "Produto", "Marca", "Qtd", "Valor Unit.", "Subtotal"],
      ...itens.map((item) => [
        item.codigoBarras || "",
        item.produtoNome,
        item.marca || "",
        String(item.quantidade),
        String(item.valorUnitario),
        String(item.quantidade * item.valorUnitario),
      ]),
    ];
    const csv = linhas.map((linha) => linha.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `orcamento-pedido-${orcamento?.numeroPedido || token}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function enviarResposta() {
    if (!orcamento || enviado) return;
    setEnviando(true);
    try {
      const response = await fetch(`/api/orcamentos/public/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itens,
          desconto: tipoDesconto === "valor" ? parseMoeda(descontoValor) : 0,
          descontoPercentual: tipoDesconto === "percentual" ? descontoPercentual : 0,
          observacoes: observacao,
          formaPagamento,
          parcelas: exigeParcelamento(formaPagamento)
            ? normalizarParcelas(parcelas)
            : 1,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        alert(data.message || "Não foi possível enviar o orçamento.");
        return;
      }
      setEnviado(true);
      setOrcamento(data);
      if (data.mensagem) {
        /* confirmação 202 — UI já mostra estado "enviado" */
      }
    } catch {
      alert("Erro ao enviar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  function abrirModalFoto(index: number) {
    if (enviado) return;
    setErroFoto("");
    setFotoModalIndex(index);
  }

  function fecharModalFoto() {
    if (enviandoFoto) return;
    setFotoModalIndex(null);
    setErroFoto("");
    if (inputFotoRef.current) inputFotoRef.current.value = "";
  }

  async function onSelecionarFotoItem(file: File | null) {
    if (fotoModalIndex == null || !file || enviado || enviandoFoto) return;
    setErroFoto("");
    if (!file.type.startsWith("image/")) {
      setErroFoto("Selecione um arquivo de imagem.");
      return;
    }
    setEnviandoFoto(true);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const res = await fetch(`/api/orcamentos/public/${token}/upload`, {
        method: "POST",
        body: formData,
      });
      const json = (await res.json().catch(() => null)) as
        | Array<{ url?: string }>
        | { error?: string }
        | null;
      if (!res.ok) {
        const err =
          json && !Array.isArray(json) ? json.error : undefined;
        throw new Error(err || "Não foi possível enviar a foto.");
      }
      const uploaded = Array.isArray(json) ? json : [];
      const url = uploaded[0]?.url?.trim();
      if (!url) throw new Error("Resposta de upload inválida.");
      atualizarItem(fotoModalIndex, "imagemUrl", url);
    } catch (err) {
      setErroFoto(err instanceof Error ? err.message : "Falha no upload da foto.");
    } finally {
      setEnviandoFoto(false);
      if (inputFotoRef.current) inputFotoRef.current.value = "";
    }
  }

  function removerFotoItem() {
    if (fotoModalIndex == null || enviado) return;
    atualizarItem(fotoModalIndex, "imagemUrl", undefined);
    setErroFoto("");
  }

  const itemFotoModal =
    fotoModalIndex != null ? itens[fotoModalIndex] ?? null : null;

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f4f6] text-sm text-slate-500">
        Carregando orçamento...
      </div>
    );
  }

  if (erro || !orcamento) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f4f6] p-6">
        <div className="max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="mb-2 text-lg font-semibold text-slate-700">Link indisponível</h1>
          <p className="text-sm text-slate-500">{erro}</p>
        </div>
      </div>
    );
  }

  const somenteLeitura = enviado;

  return (
    <div className="min-h-screen bg-[#f3f4f6] py-6 print:bg-white print:py-0">
      <div className="mx-auto max-w-5xl px-4 print:max-w-none print:px-0">
        <div className="mb-4 flex items-center justify-end print:hidden">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportarExcel}
              className="inline-flex h-8 items-center gap-1 rounded border border-slate-300 bg-white px-3 text-[11px] text-slate-600 hover:bg-slate-50"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Excel
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-8 items-center gap-1 rounded bg-blue-500 px-3 text-[11px] font-medium text-white hover:bg-blue-600"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm print:border-0 print:shadow-none">
          <div className="hidden border-b border-slate-100 py-6 text-center print:block">
            <img
              src="/images/lab-protese-logo.png"
              alt="Dente Art"
              width={300}
              height={100}
              className="mx-auto object-contain"
              style={{ width: 300, height: 100 }}
            />
          </div>

          <div className="grid gap-4 border-b border-slate-100 px-5 py-4 text-[11px] text-slate-600 md:grid-cols-3">
            <div>
              <p className="font-medium text-slate-800">{orcamento.labNome}</p>
              <p>{formatTelefone(orcamento.labTelefone)}</p>
            </div>
            <div>
              <p>
                <span className="font-medium text-slate-700">Cliente:</span>{" "}
                {orcamento.labNome}
              </p>
              <p>{orcamento.labEmail || ""}</p>
            </div>
            <div className="md:text-right">
              <p>
                <span className="font-medium text-slate-700">Pedido</span> #
                {orcamento.numeroPedido}
              </p>
              <p>
                <span className="font-medium text-slate-700">Data do Pedido:</span>{" "}
                {formatDate(orcamento.data)}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto px-5 py-4">
            {!somenteLeitura && (
              <button
                type="button"
                onClick={adicionarLinhaProduto}
                className="mb-3 inline-flex items-center gap-1 rounded border border-[#8bc34a] bg-white px-2.5 py-1 text-[10px] font-medium text-[#689f38] hover:bg-[#f1f8e9]"
              >
                <Plus className="h-3.5 w-3.5" />
                produto
              </button>
            )}
            <table className="w-full min-w-[760px] text-[10px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
                  {!somenteLeitura && (
                    <th className="w-9 px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={todosSelecionados}
                        ref={(el) => {
                          if (el) el.indeterminate = algunsSelecionados;
                        }}
                        onChange={toggleSelecionarTodos}
                        className="h-4 w-4 accent-[#4a90d9]"
                        aria-label="Selecionar todos os produtos"
                      />
                    </th>
                  )}
                  <th className="w-16 px-2 py-2 text-center font-semibold uppercase">Foto</th>
                  <th className="px-2 py-2 text-left font-semibold uppercase">Cod Barras</th>
                  <th className="px-2 py-2 text-left font-semibold uppercase">Produto</th>
                  <th className="px-2 py-2 text-left font-semibold uppercase">Marca</th>
                  <th className="px-2 py-2 text-center font-semibold uppercase">Quantidade</th>
                  <th className="px-2 py-2 text-right font-semibold uppercase">
                    Valor Unitário
                  </th>
                  <th className="px-2 py-2 text-right font-semibold uppercase">Subtotal</th>
                  {!somenteLeitura && <th className="w-9 px-1 py-2" aria-label="Excluir" />}
                </tr>
              </thead>
              <tbody>
                {itens.map((item, index) => (
                  <tr
                    key={`${item.produtoId}-${index}`}
                    className={`border-b border-slate-50 ${
                      selecionados.has(index) ? "bg-blue-50/60" : ""
                    }`}
                  >
                    {!somenteLeitura && (
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={selecionados.has(index)}
                          onChange={() => toggleSelecionar(index)}
                          className="h-4 w-4 accent-[#4a90d9]"
                          aria-label={`Selecionar ${item.produtoNome || "produto"}`}
                        />
                      </td>
                    )}
                    <td className="px-2 py-2 text-center">
                      {somenteLeitura ? (
                        <div className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50">
                          {item.imagemUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={urlImagemOrcamentoPublico(token, item.imagemUrl)}
                              alt={item.produtoNome || "Produto"}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-[10px] text-slate-300">—</span>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => abrirModalFoto(index)}
                          title={
                            item.imagemUrl
                              ? "Alterar foto do produto"
                              : "Adicionar foto do produto"
                          }
                          aria-label={
                            item.imagemUrl
                              ? "Alterar foto do produto"
                              : "Adicionar foto do produto"
                          }
                          className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50 transition hover:border-[#4a90d9] hover:bg-blue-50/50"
                        >
                          {item.imagemUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={urlImagemOrcamentoPublico(token, item.imagemUrl)}
                              alt={item.produtoNome || "Produto"}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ImagePlus className="h-5 w-5 text-slate-300" aria-hidden />
                          )}
                        </button>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {somenteLeitura ? (
                        <span className="text-slate-500">{item.codigoBarras || ""}</span>
                      ) : (
                        <input
                          value={item.codigoBarras || ""}
                          onChange={(e) =>
                            atualizarItem(index, "codigoBarras", e.target.value)
                          }
                          className={inputCelula}
                          placeholder="Código"
                          {...propsInputComSelecaoAoFocar({})}
                        />
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {somenteLeitura ? (
                        <span className="font-medium text-slate-700">{item.produtoNome}</span>
                      ) : (
                        <input
                          value={item.produtoNome}
                          onChange={(e) =>
                            atualizarItem(index, "produtoNome", e.target.value)
                          }
                          className={inputCelula}
                          placeholder="Nome do produto"
                          {...propsInputComSelecaoAoFocar({})}
                        />
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {somenteLeitura ? (
                        <span className="text-slate-500">{item.marca || ""}</span>
                      ) : (
                        <input
                          value={item.marca || ""}
                          onChange={(e) => atualizarItem(index, "marca", e.target.value)}
                          className={inputCelula}
                          placeholder="Marca"
                          {...propsInputComSelecaoAoFocar({})}
                        />
                      )}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {somenteLeitura ? (
                        item.quantidade
                      ) : (
                        <input
                          type="number"
                          min={1}
                          value={item.quantidade}
                          onChange={(e) => {
                            const qtd = Math.max(1, Number(e.target.value) || 1);
                            atualizarItem(index, "quantidade", qtd);
                          }}
                          className={`${inputCelula} mx-auto max-w-[72px] text-center`}
                          {...propsInputComSelecaoAoFocar({})}
                        />
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {somenteLeitura ? (
                        formatCurrency(item.valorUnitario)
                      ) : (
                        <input
                          value={
                            item.valorUnitario > 0
                              ? formatMoedaInput(item.valorUnitario)
                              : ""
                          }
                          placeholder="R$ 0,00"
                          onChange={(e) => atualizarValorUnitario(index, e.target.value)}
                          className="ml-auto block h-8 w-28 rounded-sm border border-slate-200 px-2 text-right text-[10px]"
                          {...propsInputComSelecaoAoFocar({})}
                        />
                      )}
                    </td>
                    <td className="px-2 py-2 text-right font-medium text-slate-700">
                      {formatCurrency(item.quantidade * item.valorUnitario)}
                    </td>
                    {!somenteLeitura && (
                      <td className="px-1 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => excluirLinha(index)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Excluir produto"
                          aria-label="Excluir produto"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end border-t border-slate-100 px-5 py-4">
            <div className="w-full max-w-xs space-y-2 text-[11px]">
              <div className="flex justify-between text-slate-600">
                <span>Valor Total:</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              {!somenteLeitura && selecionados.size > 0 && (
                <div className="flex justify-end border-b border-slate-100 pb-2">
                  <button
                    type="button"
                    onClick={excluirSelecionados}
                    className="inline-flex items-center gap-1.5 rounded border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-medium text-red-600 hover:bg-red-100"
                    title="Excluir produtos selecionados"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir selecionados ({selecionados.size})
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-600">Desconto:</span>
                <div className="flex items-center gap-1">
                  <select
                    value={tipoDesconto}
                    disabled={somenteLeitura}
                    onChange={(e) =>
                      setTipoDesconto(e.target.value as "percentual" | "valor")
                    }
                    className="h-7 w-12 rounded-sm border border-slate-200 text-[10px]"
                  >
                    <option value="percentual">%</option>
                    <option value="valor">R$</option>
                  </select>
                  {tipoDesconto === "percentual" ? (
                    <input
                      type="number"
                      min={0}
                      max={100}
                      disabled={somenteLeitura}
                      value={descontoPercentual}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") {
                          setDescontoPercentual(0);
                          return;
                        }
                        setDescontoPercentual(Number(raw));
                      }}
                      className="h-7 w-16 rounded-sm border border-slate-200 px-1 text-right text-[10px]"
                      {...propsInputComSelecaoAoFocar({})}
                    />
                  ) : (
                    <input
                      value={descontoValor}
                      disabled={somenteLeitura}
                      onChange={(e) => {
                        const valor = parseMoeda(e.target.value);
                        setDescontoValor(formatMoedaInput(valor));
                      }}
                      className="h-7 w-24 rounded-sm border border-slate-200 px-1 text-right text-[10px]"
                      {...propsInputComSelecaoAoFocar({})}
                    />
                  )}
                </div>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2 text-sm font-semibold text-blue-600">
                <span>Total Líquido:</span>
                <span>{formatCurrency(totalLiquido)}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 border-t border-slate-100 px-5 py-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">
                Observação
              </label>
              <textarea
                value={observacao}
                disabled={somenteLeitura}
                onChange={(e) => setObservacao(e.target.value)}
                rows={4}
                className="w-full rounded-sm border border-slate-200 px-2 py-1.5 text-[11px] disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">
                Condições de pagamento
              </label>
              {somenteLeitura ? (
                <p className="min-h-[88px] rounded-sm border border-slate-200 bg-slate-50 px-2 py-2 text-[11px] text-slate-700">
                  {rotuloCondicoesPagamento({
                    forma: formaPagamento,
                    parcelas: normalizarParcelas(parcelas),
                  })}
                </p>
              ) : (
                <div className="space-y-2">
                  <select
                    value={formaPagamento}
                    onChange={(e) => {
                      const forma = e.target.value as FormaPagamentoOrcamento;
                      setFormaPagamento(forma);
                      if (!exigeParcelamento(forma)) setParcelas(1);
                    }}
                    className="h-9 w-full rounded-sm border border-slate-200 px-2 text-[11px]"
                  >
                    <option value="a_vista">À vista</option>
                    <option value="pix">Pix</option>
                    <option value="cartao_credito">Cartão de crédito</option>
                    <option value="boleto">Boleto</option>
                  </select>
                  {exigeParcelamento(formaPagamento) && (
                    <select
                      value={parcelas}
                      onChange={(e) =>
                        setParcelas(normalizarParcelas(Number(e.target.value)))
                      }
                      className="h-9 w-full rounded-sm border border-slate-200 px-2 text-[11px]"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          Parcelamento {n}x
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          </div>

          {!somenteLeitura && (
            <div className="grid gap-3 border-t border-slate-100 px-5 py-4 md:grid-cols-2 print:hidden">
              <button
                type="button"
                disabled={enviando}
                onClick={() => void enviarResposta()}
                className="inline-flex h-10 items-center justify-center gap-2 rounded bg-[#8bc34a] text-[12px] font-medium text-white hover:bg-[#7cb342] disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {enviando ? "Enviando..." : "Enviar Orçamento"}
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center gap-2 rounded border border-slate-300 bg-white text-[12px] text-slate-600 hover:bg-slate-50"
              >
                <Upload className="h-4 w-4" />
                Upload Arquivo
              </button>
            </div>
          )}

          {somenteLeitura && (
            <div className="border-t border-emerald-100 bg-emerald-50 px-5 py-3 text-center text-[11px] font-medium text-emerald-700">
              Orçamento enviado com sucesso em{" "}
              {formatDate(orcamento.dataResposta)}. O laboratório já pode visualizar sua
              resposta.
            </div>
          )}
        </div>
      </div>

      {itemFotoModal && fotoModalIndex != null && !somenteLeitura ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden"
          onClick={fecharModalFoto}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-foto-titulo"
            className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2
                  id="modal-foto-titulo"
                  className="text-sm font-semibold text-slate-800"
                >
                  Foto do produto
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {itemFotoModal.produtoNome?.trim() ||
                    `Item ${fotoModalIndex + 1}`}
                </p>
              </div>
              <button
                type="button"
                onClick={fecharModalFoto}
                disabled={enviandoFoto}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mx-auto mb-4 flex h-36 w-36 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
              {itemFotoModal.imagemUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={urlImagemOrcamentoPublico(token, itemFotoModal.imagemUrl)}
                  alt={itemFotoModal.produtoNome || "Produto"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImagePlus className="h-8 w-8 text-slate-300" aria-hidden />
              )}
            </div>

            <input
              ref={inputFotoRef}
              type="file"
              accept="image/*"
              className="hidden"
              disabled={enviandoFoto}
              onChange={(e) =>
                void onSelecionarFotoItem(e.target.files?.[0] ?? null)
              }
            />

            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                disabled={enviandoFoto}
                onClick={() => inputFotoRef.current?.click()}
                className="rounded border border-slate-300 bg-white px-3 py-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {enviandoFoto
                  ? "Enviando..."
                  : itemFotoModal.imagemUrl
                    ? "Trocar foto"
                    : "Adicionar foto"}
              </button>
              {itemFotoModal.imagemUrl ? (
                <button
                  type="button"
                  disabled={enviandoFoto}
                  onClick={removerFotoItem}
                  className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-3 py-2 text-[11px] text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remover
                </button>
              ) : null}
            </div>

            {erroFoto ? (
              <p className="mt-3 text-center text-[10px] text-rose-600">{erroFoto}</p>
            ) : (
              <p className="mt-3 text-center text-[10px] text-slate-400">
                A foto será enviada junto com o orçamento. Máx. 4 MB.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
