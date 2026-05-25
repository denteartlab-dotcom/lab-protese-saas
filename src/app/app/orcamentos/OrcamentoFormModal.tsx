"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus, Trash2, X } from "lucide-react";
import { propsInputComSelecaoAoFocar } from "@/lib/input-selecao";
import {
  calcularTotaisItens,
  type ItemOrcamento,
  type Orcamento,
} from "@/lib/orcamentos-types";
import { abrirWhatsAppOrcamento, orcamentoPublicUrl } from "@/lib/whatsapp";

export type SalvarOrcamentoPayload = {
  fornecedorId: string;
  fornecedorNome: string;
  itens: ItemOrcamento[];
  whatsappEnvio: string;
  observacoes?: string;
  orcamentoId?: string;
};

export type SalvarOrcamentoResult = {
  token: string;
  numeroPedido: number;
  whatsappEnvio: string;
};

export type FornecedorContato = {
  id: string;
  nome: string;
  email?: string;
  whatsapp?: string;
  celular?: string;
  representanteEmail?: string;
  representanteWhatsapp?: string;
};

export type ProdutoOpcao = {
  id: string;
  nome: string;
  marca?: string;
  codigoBarras?: string;
  valorCusto: number;
  estoque: number;
};

type LinhaProduto = {
  linhaId: string;
  produtoId: string;
  selecionado: boolean;
  quantidade: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (payload: SalvarOrcamentoPayload) => Promise<SalvarOrcamentoResult | null>;
  orcamento: Orcamento | null;
  somenteLeitura?: boolean;
  fornecedores: FornecedorContato[];
  produtos: ProdutoOpcao[];
  preencherZerados?: boolean;
};

type OpcaoContato = { value: string; label: string };

function telefonesDoFornecedor(fornecedor: FornecedorContato): OpcaoContato[] {
  const opcoes: OpcaoContato[] = [];
  const vistos = new Set<string>();

  const adicionar = (valor?: string, rotulo?: string) => {
    const limpo = (valor || "").trim();
    if (!limpo || vistos.has(limpo)) return;
    vistos.add(limpo);
    opcoes.push({ value: limpo, label: rotulo || limpo });
  };

  adicionar(fornecedor.whatsapp, fornecedor.whatsapp);
  adicionar(fornecedor.celular, `Celular — ${fornecedor.celular}`);
  adicionar(
    fornecedor.representanteWhatsapp,
    `WhatsApp representante — ${fornecedor.representanteWhatsapp}`
  );

  return opcoes;
}

export function OrcamentoFormModal({
  open,
  onClose,
  onSave,
  orcamento,
  somenteLeitura = false,
  fornecedores,
  produtos,
  preencherZerados = false,
}: Props) {
  const contadorLinha = useRef(0);
  const [mostrarZerados, setMostrarZerados] = useState(false);
  const [fornecedorId, setFornecedorId] = useState("");
  const [whatsappEnvio, setWhatsappEnvio] = useState("");
  const [linhas, setLinhas] = useState<LinhaProduto[]>([]);

  const fornecedorSelecionado = useMemo(
    () => fornecedores.find((item) => item.id === fornecedorId),
    [fornecedores, fornecedorId]
  );

  const telefonesFornecedor = useMemo(
    () => (fornecedorSelecionado ? telefonesDoFornecedor(fornecedorSelecionado) : []),
    [fornecedorSelecionado]
  );

  const aoSelecionarFornecedor = useCallback(
    (id: string, whatsappSalvo?: string) => {
      setFornecedorId(id);
      if (!id) {
        setWhatsappEnvio("");
        return;
      }
      const fornecedor = fornecedores.find((item) => item.id === id);
      if (!fornecedor) return;

      const telefones = telefonesDoFornecedor(fornecedor);
      const whatsapp = whatsappSalvo?.trim();

      setWhatsappEnvio(
        whatsapp && telefones.some((item) => item.value === whatsapp)
          ? whatsapp
          : telefones[0]?.value || ""
      );
    },
    [fornecedores]
  );

  const produtosMap = useMemo(
    () => new Map(produtos.map((produto) => [produto.id, produto])),
    [produtos]
  );

  function criarLinhaId() {
    contadorLinha.current += 1;
    return `linha-${contadorLinha.current}`;
  }

  function novaLinhaVazia(): LinhaProduto {
    return {
      linhaId: criarLinhaId(),
      produtoId: "",
      selecionado: true,
      quantidade: 1,
    };
  }

  function linhaDeProduto(produto: ProdutoOpcao, selecionado = true): LinhaProduto {
    return {
      linhaId: criarLinhaId(),
      produtoId: produto.id,
      selecionado,
      quantidade: 1,
    };
  }

  const produtosEstoqueZero = useMemo(
    () => produtos.filter((produto) => (produto.estoque ?? 0) === 0),
    [produtos]
  );

  function produtosParaSelect(linhaId: string) {
    const idsUsados = new Set(
      linhas
        .filter((linha) => linha.linhaId !== linhaId && linha.produtoId)
        .map((linha) => linha.produtoId)
    );

    return produtos.filter((produto) => {
      if (idsUsados.has(produto.id)) return false;
      return true;
    });
  }

  const mesclarProdutosZerados = useCallback(
    (listaAtual: LinhaProduto[]) => {
      const idsNaLista = new Set(
        listaAtual.map((linha) => linha.produtoId).filter(Boolean)
      );
      const novasLinhas = produtosEstoqueZero
        .filter((produto) => !idsNaLista.has(produto.id))
        .map((produto) => linhaDeProduto(produto, true));

      if (novasLinhas.length === 0) return listaAtual;
      return [...listaAtual, ...novasLinhas];
    },
    [produtosEstoqueZero]
  );

  const removerLinhasEstoqueZero = useCallback(
    (listaAtual: LinhaProduto[]) =>
      listaAtual.filter((linha) => {
        if (!linha.produtoId) return true;
        const produto = produtosMap.get(linha.produtoId);
        return (produto?.estoque ?? 0) > 0;
      }),
    [produtosMap]
  );

  const alterarMostrarZerados = useCallback(
    (ativo: boolean) => {
      setMostrarZerados(ativo);
      if (somenteLeitura) return;
      setLinhas((atual) =>
        ativo ? mesclarProdutosZerados(atual) : removerLinhasEstoqueZero(atual)
      );
    },
    [mesclarProdutosZerados, removerLinhasEstoqueZero, somenteLeitura]
  );

  useEffect(() => {
    if (!open) return;

    if (orcamento) {
      aoSelecionarFornecedor(
        orcamento.fornecedorId || "",
        orcamento.whatsappEnvio
      );
      setLinhas(
        orcamento.itens.map((item) => ({
          linhaId: criarLinhaId(),
          produtoId: item.produtoId,
          selecionado: true,
          quantidade: item.quantidade,
        }))
      );
      const temZerado = orcamento.itens.some((item) => {
        const produto = produtos.find((p) => p.id === item.produtoId);
        return (produto?.estoque ?? 0) === 0;
      });
      setMostrarZerados(temZerado);
    } else {
      setFornecedorId("");
      setWhatsappEnvio("");
      setLinhas([]);
      setMostrarZerados(true);
      if (fornecedores.length === 1) {
        aoSelecionarFornecedor(fornecedores[0].id);
      }
    }
  }, [open, orcamento, fornecedores, aoSelecionarFornecedor]);

  useEffect(() => {
    if (!open || somenteLeitura || orcamento || produtos.length === 0) return;
    setLinhas((atual) => {
      if (atual.length > 0) return atual;
      return produtos.map((produto) => linhaDeProduto(produto, true));
    });
  }, [open, somenteLeitura, orcamento, produtos]);

  useEffect(() => {
    if (!open || !fornecedorId || somenteLeitura) return;
    const fornecedor = fornecedores.find((item) => item.id === fornecedorId);
    if (!fornecedor) return;

    const telefones = telefonesDoFornecedor(fornecedor);

    if (whatsappEnvio && !telefones.some((item) => item.value === whatsappEnvio)) {
      setWhatsappEnvio(telefones[0]?.value || "");
    } else if (!whatsappEnvio && telefones[0]) {
      setWhatsappEnvio(telefones[0].value);
    }
  }, [open, fornecedores, fornecedorId, somenteLeitura, whatsappEnvio]);

  useEffect(() => {
    if (!open || somenteLeitura || orcamento || !preencherZerados) return;
    alterarMostrarZerados(true);
  }, [open, preencherZerados, orcamento, somenteLeitura, alterarMostrarZerados]);

  useEffect(() => {
    if (!open || somenteLeitura || !mostrarZerados) return;
    setLinhas((atual) => mesclarProdutosZerados(atual));
  }, [open, somenteLeitura, mostrarZerados, produtosEstoqueZero, mesclarProdutosZerados]);

  const todosSelecionados =
    linhas.length > 0 && linhas.every((linha) => linha.selecionado);
  const algunsSelecionados =
    linhas.some((linha) => linha.selecionado) && !todosSelecionados;
  const refCheckboxTodos = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = refCheckboxTodos.current;
    if (!el) return;
    el.indeterminate = algunsSelecionados;
    el.checked = todosSelecionados;
  }, [algunsSelecionados, todosSelecionados]);

  function alternarTodos() {
    const marcar = !todosSelecionados;
    setLinhas((atual) => atual.map((linha) => ({ ...linha, selecionado: marcar })));
  }

  function adicionarLinha() {
    setLinhas((atual) => [...atual, novaLinhaVazia()]);
  }

  function removerLinha(linhaId: string) {
    setLinhas((atual) => atual.filter((linha) => linha.linhaId !== linhaId));
  }

  function selecionarProduto(linhaId: string, produtoId: string) {
    setLinhas((atual) =>
      atual.map((linha) =>
        linha.linhaId === linhaId ? { ...linha, produtoId } : linha
      )
    );
  }

  function atualizarQuantidade(linhaId: string, valor: string) {
    setLinhas((atual) =>
      atual.map((linha) => {
        if (linha.linhaId !== linhaId) return linha;
        if (valor === "" || valor === "-") return { ...linha, quantidade: 0 };
        const quantidade = Number(valor);
        if (!Number.isFinite(quantidade)) return linha;
        return { ...linha, quantidade: Math.max(Math.trunc(quantidade), 0) };
      })
    );
  }

  function normalizarQuantidadeLinha(linhaId: string) {
    setLinhas((atual) =>
      atual.map((linha) =>
        linha.linhaId === linhaId && linha.quantidade < 1
          ? { ...linha, quantidade: 1 }
          : linha
      )
    );
  }

  const [enviando, setEnviando] = useState(false);

  async function enviarOrcamento() {
    if (somenteLeitura || enviando) return;

    const itensSelecionados = linhas.filter(
      (linha) => linha.selecionado && linha.produtoId
    );
    if (itensSelecionados.length === 0) return;

    if (!fornecedorId) {
      alert("Selecione o fornecedor para enviar o orçamento.");
      return;
    }

    if (!whatsappEnvio.trim()) {
      alert("Cadastre um WhatsApp ou celular no fornecedor selecionado.");
      return;
    }

    const itens: ItemOrcamento[] = itensSelecionados.map((linha) => {
      const produto = produtosMap.get(linha.produtoId)!;
      return {
        produtoId: produto.id,
        produtoNome: produto.nome,
        marca: produto.marca,
        codigoBarras: produto.codigoBarras,
        quantidade: linha.quantidade,
        valorUnitario: 0,
      };
    });

    const fornecedor = fornecedorSelecionado;

    setEnviando(true);
    try {
      const resultado = await onSave({
        fornecedorId: fornecedor?.id || fornecedorId,
        fornecedorNome: fornecedor?.nome || "",
        itens,
        whatsappEnvio,
        observacoes: orcamento?.observacoes || "",
        orcamentoId: orcamento?.id,
      });

      if (resultado?.whatsappEnvio && resultado.token) {
        const publicUrl = orcamentoPublicUrl(
          resultado.token,
          window.location.origin
        );
        abrirWhatsAppOrcamento(resultado.whatsappEnvio, publicUrl);
      }
    } finally {
      setEnviando(false);
    }
  }

  if (!open) return null;

  const titulo = somenteLeitura
    ? `Pedido #${orcamento?.numeroPedido || ""}`
    : "Gerar Lista de Orçamento Produtos";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-md bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-[15px] font-normal text-slate-700">{titulo}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-[11px] text-slate-600">
          {!somenteLeitura && (
            <label className="mb-4 flex cursor-pointer items-center gap-2">
              <span
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
                  mostrarZerados ? "bg-emerald-400" : "bg-slate-300"
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={mostrarZerados}
                  onChange={(e) => alterarMostrarZerados(e.target.checked)}
                />
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                    mostrarZerados ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </span>
              <span className="text-[11px] text-slate-600">Mostrar produtos com estoque zero</span>
            </label>
          )}

          <div className="mb-3 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] text-slate-600">Fornecedor</label>
              <select
                value={fornecedorId}
                disabled={somenteLeitura}
                onChange={(e) => aoSelecionarFornecedor(e.target.value)}
                className="h-9 w-full rounded-sm border border-slate-200 bg-white px-2 text-[11px] text-slate-600 outline-none focus:border-blue-400 disabled:bg-slate-50"
              >
                <option value="">Selecione o fornecedor</option>
                {fornecedores.map((fornecedor) => (
                  <option key={fornecedor.id} value={fornecedor.id}>
                    {fornecedor.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-600">Whatsapp:</label>
              <select
                value={whatsappEnvio}
                disabled={somenteLeitura || !fornecedorId}
                onChange={(e) => setWhatsappEnvio(e.target.value)}
                className="h-9 w-full rounded-sm border border-slate-200 bg-white px-2 text-[11px] text-slate-500 outline-none focus:border-blue-400 disabled:bg-slate-50"
              >
                <option value="">
                  {fornecedorId
                    ? telefonesFornecedor.length > 0
                      ? "Selecione um telefone"
                      : "Sem telefone no cadastro"
                    : "Selecione o fornecedor antes"}
                </option>
                {telefonesFornecedor.map((opcao) => (
                  <option key={opcao.value} value={opcao.value}>
                    {opcao.label}
                  </option>
                ))}
              </select>
              {fornecedorId && telefonesFornecedor.length === 0 && !somenteLeitura && (
                <p className="mt-1 text-[10px] text-amber-600">
                  Cadastre WhatsApp ou celular em Cadastros → Fornecedores.
                </p>
              )}
            </div>
          </div>

          <div className="mb-4 rounded-sm bg-[#f8e8c8] px-4 py-2.5 text-center text-[11px] font-medium text-[#9a7b3c]">
            Selecione os produtos que deseja realizar o orçamento!
          </div>

          <div className="overflow-hidden rounded-sm border border-slate-200">
            <table className="w-full table-fixed text-[10px]">
              <thead>
                <tr className="bg-[#f5f5f5] text-slate-500">
                  <th className="w-[72px] px-2 py-2.5 text-center font-semibold uppercase">
                    <label className="inline-flex cursor-pointer select-none items-center gap-1.5">
                      <input
                        ref={refCheckboxTodos}
                        type="checkbox"
                        checked={todosSelecionados}
                        disabled={somenteLeitura || linhas.length === 0}
                        onChange={alternarTodos}
                        className="h-4 w-4 cursor-pointer rounded border-slate-300 text-slate-600 accent-slate-500"
                      />
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                        Todos
                      </span>
                    </label>
                  </th>
                  <th className="w-[34%] px-2 py-2.5 text-left font-semibold uppercase">Nome</th>
                  <th className="w-[22%] px-2 py-2.5 text-left font-semibold uppercase">Marca</th>
                  <th className="w-[10%] px-2 py-2.5 text-right font-semibold uppercase">Estoque</th>
                  <th className="w-[12%] px-2 py-2.5 text-right font-semibold uppercase">
                    Quantidade
                  </th>
                  <th className="w-[10%] px-2 py-2.5 text-right font-semibold uppercase">Opções</th>
                </tr>
              </thead>
              <tbody>
                {linhas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="h-12" />
                  </tr>
                ) : (
                  linhas.map((linha) => {
                    const produto = linha.produtoId
                      ? produtosMap.get(linha.produtoId)
                      : undefined;
                    const opcoesSelect = produtosParaSelect(linha.linhaId);

                    return (
                      <tr key={linha.linhaId} className="border-t border-slate-100 bg-white">
                        <td className="px-2 py-2 text-center align-middle">
                          <label className="inline-flex cursor-pointer">
                            <input
                              type="checkbox"
                              checked={linha.selecionado}
                              disabled={somenteLeitura}
                              onChange={(e) =>
                                setLinhas((atual) =>
                                  atual.map((item) =>
                                    item.linhaId === linha.linhaId
                                      ? { ...item, selecionado: e.target.checked }
                                      : item
                                  )
                                )
                              }
                              className="h-4 w-4 cursor-pointer rounded border-slate-300 text-slate-600 accent-slate-500 disabled:cursor-not-allowed"
                            />
                          </label>
                        </td>
                        <td className="px-2 py-2 align-middle">
                          {somenteLeitura ? (
                            <span className="text-slate-700">{produto?.nome || ""}</span>
                          ) : (
                            <div className="relative">
                              <select
                                value={linha.produtoId}
                                onChange={(e) =>
                                  selecionarProduto(linha.linhaId, e.target.value)
                                }
                                className="h-8 w-full appearance-none rounded-sm border border-slate-200 bg-white pl-2 pr-7 text-[10px] text-slate-600 outline-none focus:border-blue-400"
                              >
                                <option value="" />
                                {opcoesSelect.map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.nome}
                                  </option>
                                ))}
                                {produto &&
                                  !opcoesSelect.some((item) => item.id === produto.id) && (
                                    <option value={produto.id}>{produto.nome}</option>
                                  )}
                              </select>
                              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2 align-middle text-slate-500">
                          {produto?.marca || ""}
                        </td>
                        <td className="px-2 py-2 text-right align-middle text-slate-600">
                          {produto ? produto.estoque : 0}
                        </td>
                        <td className="px-2 py-2 text-right align-middle">
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={linha.quantidade > 0 ? linha.quantidade : ""}
                            disabled={somenteLeitura}
                            onChange={(e) =>
                              atualizarQuantidade(linha.linhaId, e.target.value)
                            }
                            onBlur={() => normalizarQuantidadeLinha(linha.linhaId)}
                            className="ml-auto block h-8 w-full max-w-[72px] rounded-sm border border-slate-200 px-1 text-right text-[10px] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-auto [&::-webkit-outer-spin-button]:appearance-auto"
                            {...propsInputComSelecaoAoFocar({})}
                          />
                        </td>
                        <td className="px-2 py-2 text-right align-middle">
                          {!somenteLeitura && (
                            <button
                              type="button"
                              onClick={() => removerLinha(linha.linhaId)}
                              className="inline-flex text-red-500 hover:text-red-600"
                              aria-label="Remover"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {!somenteLeitura && (
            <button
              type="button"
              onClick={adicionarLinha}
              className="mt-3 inline-flex h-7 items-center gap-1 rounded-sm bg-[#8bc34a] px-3 text-[10px] font-semibold text-white hover:bg-[#7cb342]"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar Produtos
            </button>
          )}
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-0 border-t border-slate-200">
          {!somenteLeitura ? (
            <button
              type="button"
              onClick={() => void enviarOrcamento()}
              disabled={enviando}
              className="h-11 bg-[#8bc34a] text-[12px] font-medium text-white hover:bg-[#7cb342] disabled:opacity-60"
            >
              {enviando ? "Enviando..." : "Enviar Orçamento"}
            </button>
          ) : (
            <div className="h-11 bg-slate-100" />
          )}
          <button
            type="button"
            onClick={onClose}
            className="h-11 border-l border-slate-200 bg-white text-[12px] font-medium text-slate-700 hover:bg-slate-50"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
