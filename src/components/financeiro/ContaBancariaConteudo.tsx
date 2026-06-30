"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  ArrowUpFromLine,
  Box,
  Eye,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { ConfirmacaoExclusaoModal } from "@/components/ConfirmacaoExclusaoModal";
import { CadastrarContaBancariaModal } from "@/components/financeiro/CadastrarContaBancariaModal";
import { ConciliacaoContaModal } from "@/components/financeiro/ConciliacaoContaModal";
import { MovimentacaoContaModal } from "@/components/financeiro/MovimentacaoContaModal";
import { TransferenciasAjustesSaldoModal } from "@/components/financeiro/TransferenciasAjustesSaldoModal";
import {
  armazenamentoLaboratorioPronto,
  ARMAZENAMENTO_LAB_PRONTO_EVENT,
} from "@/lib/armazenamento-laboratorio";
import {
  calcularSaldoConta,
  carregarContasBancarias,
  carregarMovimentacoesConta,
  classeBotaoAcaoConta,
  contaFromForm,
  contaFromFormEdicao,
  contaPermiteEditarNaLista,
  ID_CONTA_CAIXA,
  ID_CONTA_CARTEIRA,
  ID_CONTA_NF,
  labelAcaoConta,
  salvarContasBancarias,
  salvarMovimentacoesConta,
  type AcaoContaBancaria,
  type ContaBancaria,
  type DadosFormContaBancaria,
  type MovimentacaoContaBancaria,
} from "@/lib/conta-bancaria";
import {
  FINANCEIRO_ATUALIZADO_EVENT,
  notificarFinanceiroAtualizado,
} from "@/lib/financeiro-events";
import {
  carregarLancamentosFinanceiroCache,
  salvarLancamentosFinanceiroCache,
  type LancamentoFinanceiroCache,
} from "@/lib/financeiro-lancamentos-cache";
import {
  carregarExtratoBancario,
  mesclarExtrato,
  salvarExtratoBancario,
  type ExtratoMovimentacao,
} from "@/lib/extrato-bancario";
import {
  carregarContasBancariasApi,
  mesclarMovimentacoesConta,
  persistirContasBancariasApi,
} from "@/lib/conta-bancaria-api";
import { cn } from "@/lib/utils";

function hidratarDadosLocais() {
  return {
    contas: carregarContasBancarias(),
    movimentacoes: carregarMovimentacoesConta(),
    lancamentos: carregarLancamentosFinanceiroCache(),
  };
}

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function classeSaldoConta(saldo: number) {
  if (saldo < 0) return "text-[#dc2626] dark:text-red-400";
  if (saldo > 0) return "text-[#4cae4c] dark:text-emerald-400";
  return "text-slate-500 dark:text-slate-400";
}

const thClass =
  "border-b border-[#e0e0e0] bg-[#f5f6f8] px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";

function valorCampoConta(valor?: string) {
  const limpo = valor?.trim();
  return limpo || "—";
}

export function ContaBancariaConteudo() {
  const [contas, setContas] = useState<ContaBancaria[]>(() =>
    typeof window !== "undefined" ? carregarContasBancarias() : []
  );
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoContaBancaria[]>(
    () => (typeof window !== "undefined" ? carregarMovimentacoesConta() : [])
  );
  const [lancamentos, setLancamentos] = useState<LancamentoFinanceiroCache[]>(
    () =>
      typeof window !== "undefined" ? carregarLancamentosFinanceiroCache() : []
  );
  const [busca, setBusca] = useState("");
  const [verExcluidos, setVerExcluidos] = useState(false);
  const [modalAdicionar, setModalAdicionar] = useState(false);
  const [modalEditar, setModalEditar] = useState<ContaBancaria | null>(null);
  const [modalTransferir, setModalTransferir] = useState<ContaBancaria | null>(
    null
  );
  const [modalAcao, setModalAcao] = useState<{
    conta: ContaBancaria;
    acao: AcaoContaBancaria;
  } | null>(null);
  const [modalConciliar, setModalConciliar] = useState(false);
  const [cadastroConciliacao, setCadastroConciliacao] = useState<{
    form: DadosFormContaBancaria;
    extrato: Omit<ExtratoMovimentacao, "contaId">[];
  } | null>(null);
  const [contaVisualizada, setContaVisualizada] = useState<string | null>(null);
  const [contaExcluirConfirmacao, setContaExcluirConfirmacao] =
    useState<ContaBancaria | null>(null);
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>(
    []
  );

  const aplicarDadosLocais = useCallback(() => {
    const local = hidratarDadosLocais();
    setContas(local.contas);
    setMovimentacoes(local.movimentacoes);
    if (local.lancamentos.length > 0) {
      setLancamentos(local.lancamentos);
    }
  }, []);

  const carregarLancamentos = useCallback(async () => {
    try {
      const res = await fetch("/api/financeiro", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as {
        lancamentos?: LancamentoFinanceiroCache[];
      };
      const lista = Array.isArray(json.lancamentos) ? json.lancamentos : [];
      setLancamentos(lista);
      salvarLancamentosFinanceiroCache(lista);
    } catch {
      /* mantém cache/local */
    }
  }, []);

  const carregarDados = useCallback(async () => {
    const [dados, resFinanceiro] = await Promise.all([
      carregarContasBancariasApi(),
      fetch("/api/financeiro", { cache: "no-store" }).catch(() => null),
    ]);

    setContas(dados.contas);
    setMovimentacoes((atual) => {
      const mesclado = mesclarMovimentacoesConta(atual, dados.movimentacoes);
      salvarMovimentacoesConta(mesclado);
      return mesclado;
    });

    if (resFinanceiro?.ok) {
      try {
        const json = (await resFinanceiro.json()) as {
          lancamentos?: LancamentoFinanceiroCache[];
        };
        const lista = Array.isArray(json.lancamentos) ? json.lancamentos : [];
        setLancamentos(lista);
        salvarLancamentosFinanceiroCache(lista);
      } catch {
        /* mantém cache/local */
      }
    }
  }, []);

  useEffect(() => {
    aplicarDadosLocais();
    if (!armazenamentoLaboratorioPronto()) {
      window.addEventListener(ARMAZENAMENTO_LAB_PRONTO_EVENT, aplicarDadosLocais);
    }
    void carregarDados();

    return () => {
      window.removeEventListener(
        ARMAZENAMENTO_LAB_PRONTO_EVENT,
        aplicarDadosLocais
      );
    };
  }, [aplicarDadosLocais, carregarDados]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const atualizarFinanceiroConta = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void (async () => {
          await carregarLancamentos();
          try {
            const dados = await carregarContasBancariasApi();
            setMovimentacoes(dados.movimentacoes);
            salvarMovimentacoesConta(dados.movimentacoes);
          } catch {
            /* mantém movimentações locais */
          }
        })();
      }, 480);
    };
    window.addEventListener(
      FINANCEIRO_ATUALIZADO_EVENT,
      atualizarFinanceiroConta
    );
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(
        FINANCEIRO_ATUALIZADO_EVENT,
        atualizarFinanceiroConta
      );
    };
  }, [carregarLancamentos]);

  const contasVisiveis = useMemo(() => {
    const lista = contas.filter((c) =>
      verExcluidos ? Boolean(c.excluida) : !c.excluida
    );
    const termo = busca.trim().toLowerCase();
    if (!termo) return lista;
    return lista.filter((c) => c.nome.toLowerCase().includes(termo));
  }, [contas, busca, verExcluidos]);

  const linhas = useMemo(
    () =>
      contasVisiveis.map((conta) => ({
        conta,
        saldo: calcularSaldoConta(conta, lancamentos, movimentacoes),
      })),
    [contasVisiveis, lancamentos, movimentacoes]
  );

  async function sincronizarMovimentacoesServidor(
    novaLista: MovimentacaoContaBancaria[]
  ) {
    const resultado = await persistirContasBancariasApi({
      movimentacoes: novaLista,
    });
    if (resultado?.movimentacoes) {
      setMovimentacoes(resultado.movimentacoes);
      salvarMovimentacoesConta(resultado.movimentacoes);
    }
  }

  function persistirContas(novaLista: ContaBancaria[]) {
    setContas(novaLista);
    salvarContasBancarias(novaLista);
    void persistirContasBancariasApi({ contas: novaLista }).then(() => {
      notificarFinanceiroAtualizado();
    });
  }

  function aplicarExtratoPendente(
    contaId: string,
    pendente?: Omit<ExtratoMovimentacao, "contaId">[]
  ) {
    if (!pendente?.length) return;
    const movs: ExtratoMovimentacao[] = pendente.map((m, i) => ({
      ...m,
      contaId,
      id: m.id || `ext-${Date.now()}-${i}`,
    }));
    const extrato = mesclarExtrato(carregarExtratoBancario(), movs);
    salvarExtratoBancario(extrato);
    void persistirContasBancariasApi({ extrato });
  }

  function adicionarConta(
    dados: DadosFormContaBancaria,
    extratoPendente?: Omit<ExtratoMovimentacao, "contaId">[]
  ) {
    const nova = contaFromForm(dados);
    persistirContas([...contas, nova]);
    aplicarExtratoPendente(nova.id, extratoPendente);
    setModalAdicionar(false);
  }

  function salvarEdicao(
    dados: DadosFormContaBancaria,
    extratoPendente?: Omit<ExtratoMovimentacao, "contaId">[]
  ) {
    if (!modalEditar) return;
    const atualizada = contaFromFormEdicao(dados, modalEditar);
    persistirContas(
      contas.map((c) => (c.id === modalEditar.id ? atualizada : c))
    );
    aplicarExtratoPendente(modalEditar.id, extratoPendente);
    setModalEditar(null);
  }

  function registrarMovimentacao(
    conta: ContaBancaria,
    tipo: "entrada" | "saida",
    valor: number,
    descricao: string
  ) {
    const mov: MovimentacaoContaBancaria = {
      id: `mov-${Date.now()}`,
      contaId: conta.id,
      tipo,
      valor,
      descricao,
      data: new Date().toISOString(),
    };
    setMovimentacoes((atual) => {
      const novaLista = [...atual, mov];
      salvarMovimentacoesConta(novaLista);
      void sincronizarMovimentacoesServidor(novaLista).then(() => {
        notificarFinanceiroAtualizado();
      });
      return novaLista;
    });
  }

  function confirmarMovimentacao(dados: {
    contaDestinoId: string;
    tipo: string;
    valor: number;
    descricao: string;
  }) {
    if (!modalAcao) return;
    const { conta } = modalAcao;
    const desc =
      dados.descricao.trim() ||
      (dados.tipo === "Transferência"
        ? "Transferência"
        : dados.tipo);

    if (dados.tipo === "Transferência") {
      const destino = contas.find((c) => c.id === dados.contaDestinoId);
      if (!destino || destino.id === conta.id) return;
      const ts = Date.now();
      const saida: MovimentacaoContaBancaria = {
        id: `mov-${ts}-s`,
        contaId: conta.id,
        tipo: "saida",
        valor: dados.valor,
        descricao: desc || `Transferência para ${destino.nome}`,
        data: new Date().toISOString(),
      };
      const entrada: MovimentacaoContaBancaria = {
        id: `mov-${ts}-e`,
        contaId: destino.id,
        tipo: "entrada",
        valor: dados.valor,
        descricao: desc || `Transferência de ${conta.nome}`,
        data: new Date().toISOString(),
      };
      setMovimentacoes((atual) => {
        const novaLista = [...atual, saida, entrada];
        salvarMovimentacoesConta(novaLista);
        void sincronizarMovimentacoesServidor(novaLista).then(() => {
          notificarFinanceiroAtualizado();
        });
        return novaLista;
      });
    } else if (dados.tipo === "Ajuste Saldo (Debitar)") {
      registrarMovimentacao(conta, "saida", dados.valor, desc);
    } else if (dados.tipo === "Ajuste Saldo (Creditar)") {
      registrarMovimentacao(conta, "entrada", dados.valor, desc);
    }
    setModalAcao(null);
  }

  const contaPodeExcluir = (conta: ContaBancaria) =>
    ![
      ID_CONTA_CAIXA,
      ID_CONTA_CARTEIRA,
      ID_CONTA_NF,
    ].includes(conta.id);

  function solicitarExclusaoConta(conta: ContaBancaria) {
    if (!contaPodeExcluir(conta)) return;
    setModalEditar((atual) => (atual?.id === conta.id ? null : atual));
    setContaVisualizada((atual) => (atual === conta.id ? null : atual));
    setContaExcluirConfirmacao(conta);
  }

  function confirmarExclusaoConta() {
    if (!contaExcluirConfirmacao) return;
    persistirContas(
      contas.map((c) =>
        c.id === contaExcluirConfirmacao.id ? { ...c, excluida: true } : c
      )
    );
    setContaExcluirConfirmacao(null);
  }

  function restaurarConta(conta: ContaBancaria) {
    persistirContas(
      contas.map((c) =>
        c.id === conta.id ? { ...c, excluida: false } : c
      )
    );
  }

  return (
    <div className="space-y-4 text-xs text-slate-600">
      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
        <span>Financeiro</span>
        <span className="text-slate-400">&gt;</span>
        <span className="font-medium text-slate-600">Conta Bancária</span>
      </div>

      <h1 className="text-2xl font-normal text-slate-700">Financeiro</h1>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setModalAdicionar(true)}
          className="inline-flex items-center gap-1.5 rounded bg-[#4cae4c] px-4 py-2 text-[13px] font-normal text-white hover:bg-[#449d44]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Adicionar Conta
        </button>
        <button
          type="button"
          onClick={() => setModalConciliar(true)}
          className="inline-flex items-center gap-1.5 rounded border border-[#4cae4c] bg-white px-4 py-2 text-[13px] text-[#4cae4c] hover:bg-[#f0faf0] dark:border-emerald-700 dark:bg-slate-900 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
        >
          <ArrowUpFromLine className="h-4 w-4" />
          Conciliar
        </button>
        <button
          type="button"
          onClick={() => setVerExcluidos((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded border px-4 py-2 text-[13px] hover:bg-[#f0f7ff]",
            verExcluidos
              ? "border-[#4a90d9] bg-[#e8f2fc] text-[#4a90d9] dark:border-[#4a90d9] dark:bg-slate-800 dark:text-[#7eb8f7]"
              : "border-[#4a90d9] bg-white text-[#4a90d9] dark:bg-slate-900 dark:text-[#7eb8f7]"
          )}
        >
          <Eye className="h-4 w-4" />
          Ver Excluídos
        </button>
      </div>

      <div className="flex overflow-hidden rounded border border-[#d4d4d4] bg-white shadow-sm dark:border-slate-600 dark:bg-slate-900">
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Procurar"
          className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-[13px] text-slate-800 outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
        />
        <button
          type="button"
          onClick={() => setBusca("")}
          className="shrink-0 border-l border-[#e0e0e0] bg-transparent px-4 py-2.5 text-[12px] text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          Limpar
        </button>
      </div>

      <div className="overflow-hidden rounded border border-[#d4d4d4] bg-white shadow-sm dark:border-slate-600 dark:bg-slate-900">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              <th className={thClass}>Nome</th>
              <th className={cn(thClass, "text-right")}>Saldo</th>
              <th className={cn(thClass, "w-[280px] text-center")}>Opções</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-10 text-center text-[13px] text-slate-400 dark:text-slate-500"
                >
                  {verExcluidos
                    ? "Nenhuma conta excluída."
                    : "Nenhuma conta encontrada."}
                </td>
              </tr>
            ) : (
              linhas.map(({ conta, saldo }, index) => {
                const expandida = contaVisualizada === conta.id;
                return (
                  <Fragment key={conta.id}>
                    <tr
                      className={cn(
                        "border-b border-[#ececec] text-[13px] dark:border-slate-700",
                        expandida
                          ? "bg-white dark:bg-slate-900"
                          : index % 2 === 1
                            ? "bg-[#fafafa] dark:bg-slate-800/60"
                            : "bg-white dark:bg-slate-900"
                      )}
                    >
                      <td className="px-4 py-3 font-normal text-slate-800 dark:text-slate-100">
                        <span>{conta.nome}</span>
                        {conta.modoVinculo === "open_finance" &&
                        conta.openFinance?.itemId ? (
                          <span className="ml-2 rounded bg-[#e8f2fc] px-1.5 py-0.5 text-[10px] text-[#4a90d9] dark:bg-slate-700 dark:text-sky-300">
                            Open Finance
                          </span>
                        ) : conta.modoVinculo === "extrato_arquivo" ? (
                          <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                            Extrato arquivo
                          </span>
                        ) : null}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 text-right tabular-nums",
                          classeSaldoConta(saldo)
                        )}
                      >
                        {money(saldo)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-2">
                          {verExcluidos ? (
                            <button
                              type="button"
                              onClick={() => restaurarConta(conta)}
                              className="rounded border border-[#4a90d9] px-3 py-1 text-[12px] text-[#4a90d9] hover:bg-[#f0f7ff] dark:border-sky-600 dark:text-sky-300 dark:hover:bg-slate-800"
                            >
                              Restaurar
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                title="Visualizar"
                                onClick={() =>
                                  setContaVisualizada((atual) =>
                                    atual === conta.id ? null : conta.id
                                  )
                                }
                                className={cn(
                                  "inline-flex h-8 w-8 items-center justify-center hover:text-[#4a90d9] dark:hover:text-sky-300",
                                  expandida
                                    ? "rounded-sm bg-[#e8f2fc] text-[#4a90d9] dark:bg-slate-700 dark:text-sky-300"
                                    : "text-slate-500 dark:text-slate-400"
                                )}
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              {contaPermiteEditarNaLista(conta) ? (
                                <button
                                  type="button"
                                  title="Editar"
                                  onClick={() => setModalEditar(conta)}
                                  className="inline-flex h-8 w-8 items-center justify-center text-slate-500 hover:text-[#4a90d9] dark:text-slate-400 dark:hover:text-sky-300"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                              ) : null}
                              <button
                                type="button"
                                title="Transferências e Ajustes"
                                onClick={() => setModalTransferir(conta)}
                                className="inline-flex h-8 w-8 items-center justify-center text-slate-500 hover:text-[#4a90d9] dark:text-slate-400 dark:hover:text-sky-300"
                              >
                                <ArrowLeftRight className="h-4 w-4" />
                              </button>
                              {contaPodeExcluir(conta) ? (
                                <button
                                  type="button"
                                  title="Excluir"
                                  onClick={() => solicitarExclusaoConta(conta)}
                                  className="inline-flex h-8 w-8 items-center justify-center text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() =>
                                  setModalAcao({
                                    conta,
                                    acao: conta.acaoPrincipal,
                                  })
                                }
                                className={cn(
                                  "inline-flex items-center rounded px-3 py-1.5 text-[12px] font-normal text-white",
                                  classeBotaoAcaoConta(conta.acaoPrincipal)
                                )}
                              >
                                {labelAcaoConta(conta.acaoPrincipal)}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandida ? (
                      <tr className="border-b border-[#ececec] bg-white dark:border-slate-700 dark:bg-slate-900">
                        <td colSpan={3} className="bg-white px-4 py-3 dark:bg-slate-900">
                          <div className="rounded border border-[#e8e8e8] bg-white px-5 py-4 dark:border-slate-600 dark:bg-white">
                            <div className="mb-4 flex items-center gap-2">
                              <Box
                                className="h-[18px] w-[18px] text-[#4cae4c]"
                                strokeWidth={1.75}
                              />
                              <span className="text-[15px] font-bold leading-none text-[#4cae4c]">
                                {conta.nome}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 gap-y-2 text-[12px] leading-relaxed text-slate-800 md:grid-cols-4 md:gap-x-6">
                              <div className="min-w-0">
                                <span className="font-bold uppercase tracking-wide text-slate-800">
                                  NOME :
                                </span>{" "}
                                <span className="text-slate-700">{conta.nome}</span>
                              </div>
                              <div className="min-w-0 md:pl-2">
                                <span className="font-semibold text-slate-800">
                                  Agência:
                                </span>{" "}
                                <span className="text-slate-700">
                                  {valorCampoConta(conta.agencia)}
                                </span>
                              </div>
                              <div className="min-w-0 md:pl-2">
                                <span className="font-semibold text-slate-800">
                                  Número da Conta:
                                </span>{" "}
                                <span className="text-slate-700">
                                  {valorCampoConta(conta.numeroConta)}
                                </span>
                              </div>
                              <div className="min-w-0 md:pl-2">
                                <span className="font-semibold text-slate-800">
                                  Chave Pix:
                                </span>{" "}
                                <span className="text-slate-700">
                                  {valorCampoConta(conta.chavePix)}
                                </span>
                              </div>
                            </div>

                            <div className="mt-3 text-[12px] text-slate-800">
                              <span className="font-bold uppercase tracking-wide">
                                SALDO :
                              </span>{" "}
                              <span
                                className={cn(
                                  "font-semibold tabular-nums",
                                  classeSaldoConta(saldo)
                                )}
                              >
                                {money(saldo)}
                              </span>
                            </div>

                            <div className="mt-4">
                              <button
                                type="button"
                                onClick={() => setContaVisualizada(null)}
                                className="h-8 rounded border border-[#c8c8c8] bg-white px-4 text-[12px] font-normal text-slate-800 hover:bg-[#fafafa]"
                              >
                                Fechar Detalhes
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <CadastrarContaBancariaModal
        open={modalAdicionar || cadastroConciliacao !== null}
        onClose={() => {
          setModalAdicionar(false);
          setCadastroConciliacao(null);
        }}
        onCadastrar={(dados, extrato) => {
          adicionarConta(dados, extrato);
          setCadastroConciliacao(null);
        }}
        dadosIniciais={cadastroConciliacao?.form ?? null}
        extratoInicial={cadastroConciliacao?.extrato}
      />

      <CadastrarContaBancariaModal
        open={modalEditar !== null}
        onClose={() => setModalEditar(null)}
        onCadastrar={adicionarConta}
        contaEdicao={modalEditar}
        onSalvarEdicao={salvarEdicao}
        onExcluir={
          modalEditar && contaPodeExcluir(modalEditar)
            ? () => solicitarExclusaoConta(modalEditar)
            : undefined
        }
      />

      <ConfirmacaoExclusaoModal
        open={contaExcluirConfirmacao !== null}
        titulo="Excluir Conta Bancária"
        mensagem={
          contaExcluirConfirmacao
            ? `Deseja realmente excluir a conta "${contaExcluirConfirmacao.nome}"?`
            : ""
        }
        aviso="A conta será movida para a lista de excluídos. Você pode restaurá-la em Ver Excluídos."
        onClose={() => setContaExcluirConfirmacao(null)}
        onConfirm={confirmarExclusaoConta}
        labelConfirmar="Sim, excluir"
        labelCancelar="Não"
      />

      <TransferenciasAjustesSaldoModal
        open={modalTransferir !== null}
        onClose={() => setModalTransferir(null)}
        contas={contas}
        movimentacoes={movimentacoes}
        contaInicial={modalTransferir}
      />

      <MovimentacaoContaModal
        open={modalAcao !== null}
        onClose={() => setModalAcao(null)}
        conta={modalAcao?.conta ?? null}
        saldo={
          modalAcao
            ? calcularSaldoConta(
                modalAcao.conta,
                lancamentos,
                movimentacoes
              )
            : 0
        }
        contas={contas}
        acao={modalAcao?.acao}
        onConfirmar={confirmarMovimentacao}
      />

      <ConciliacaoContaModal
        open={modalConciliar}
        onClose={() => setModalConciliar(false)}
        contas={contas}
        lancamentos={lancamentos}
        clientes={clientes}
        onLancamentoCriado={(lancamento) => {
          setLancamentos((atual) => {
            if (atual.some((l) => l.id === lancamento.id)) return atual;
            const next = [...atual, lancamento];
            salvarLancamentosFinanceiroCache(next);
            return next;
          });
        }}
        onConciliacaoSalva={async () => {
          await carregarDados();
          notificarFinanceiroAtualizado();
        }}
        onAbrirCadastro={(form, extrato) => {
          setModalConciliar(false);
          setCadastroConciliacao({ form, extrato });
        }}
      />

    </div>
  );
}
