"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeftRight,
  ArrowUpFromLine,
  Eye,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import { CadastrarContaBancariaModal } from "@/components/financeiro/CadastrarContaBancariaModal";
import { ConciliacaoContaModal } from "@/components/financeiro/ConciliacaoContaModal";
import { ExtratoBancarioModal } from "@/components/financeiro/ExtratoBancarioModal";
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
import { notificarFinanceiroAtualizado } from "@/lib/financeiro-events";
import {
  carregarExtratoBancario,
  mesclarExtrato,
  salvarExtratoBancario,
  type ExtratoMovimentacao,
} from "@/lib/extrato-bancario";
import { cn } from "@/lib/utils";

type LancamentoApi = {
  tipo: string;
  descricao: string;
  valor: number;
  status: string;
};

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseMoneyBr(value: string) {
  const n = Number(
    value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")
  );
  return Number.isFinite(n) ? n : 0;
}

const thClass =
  "border-b border-[#e0e0e0] bg-[#f5f6f8] px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";

const inputClass =
  "h-9 w-full rounded border border-[#d4d4d4] bg-white px-2.5 text-[13px] text-slate-800 outline-none focus:border-[#4a90d9] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-[#4a90d9]";

function ModalSimples({
  titulo,
  open,
  onClose,
  children,
  footer,
}: {
  titulo: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/45 p-4 pt-12">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md rounded border border-[#d4d4d4] bg-white shadow-xl dark:border-slate-600 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-[#e5e5e5] px-4 py-3 dark:border-slate-700">
          <h2 className="text-[15px] font-normal text-slate-800 dark:text-slate-100">{titulo}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-4 py-4">{children}</div>
        {footer ? (
          <div className="flex gap-2 border-t border-[#e5e5e5] px-4 py-3 dark:border-slate-700">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

export function ContaBancariaConteudo() {
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoContaBancaria[]>(
    []
  );
  const [lancamentos, setLancamentos] = useState<LancamentoApi[]>([]);
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
  const [modalExtrato, setModalExtrato] = useState<ContaBancaria | null>(null);
  const [valorMov, setValorMov] = useState("");
  const [descMov, setDescMov] = useState("");
  const [contaDestinoId, setContaDestinoId] = useState("");
  const [valorTransf, setValorTransf] = useState("");

  const carregarDados = useCallback(async () => {
    setContas(carregarContasBancarias());
    setMovimentacoes(carregarMovimentacoesConta());
    try {
      const res = await fetch("/api/financeiro");
      if (res.ok) {
        const json = await res.json();
        setLancamentos(json.lancamentos || []);
      }
    } catch {
      setLancamentos([]);
    }
  }, []);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

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

  function persistirContas(novaLista: ContaBancaria[]) {
    setContas(novaLista);
    salvarContasBancarias(novaLista);
    notificarFinanceiroAtualizado();
  }

  function persistirMovs(novaLista: MovimentacaoContaBancaria[]) {
    setMovimentacoes(novaLista);
    salvarMovimentacoesConta(novaLista);
    notificarFinanceiroAtualizado();
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
    salvarExtratoBancario(
      mesclarExtrato(carregarExtratoBancario(), movs)
    );
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

  function atualizarContaNaLista(conta: ContaBancaria) {
    persistirContas(contas.map((c) => (c.id === conta.id ? conta : c)));
    if (modalExtrato?.id === conta.id) setModalExtrato(conta);
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
    persistirMovs([...movimentacoes, mov]);
  }

  function confirmarAcaoConta() {
    if (!modalAcao) return;
    const valor = parseMoneyBr(valorMov);
    if (valor <= 0) return;
    const { conta, acao } = modalAcao;
    if (acao === "baixar") {
      registrarMovimentacao(conta, "saida", valor, descMov || "Baixa");
    } else {
      registrarMovimentacao(
        conta,
        "entrada",
        valor,
        descMov ||
          (acao === "adicionar_credito" ? "Crédito adicionado" : "Movimentação")
      );
    }
    setValorMov("");
    setDescMov("");
    setModalAcao(null);
  }

  function confirmarTransferencia() {
    if (!modalTransferir) return;
    const valor = parseMoneyBr(valorTransf);
    const destino = contas.find((c) => c.id === contaDestinoId);
    if (!destino || valor <= 0 || destino.id === modalTransferir.id) return;

    const ts = Date.now();
    const saida: MovimentacaoContaBancaria = {
      id: `mov-${ts}-s`,
      contaId: modalTransferir.id,
      tipo: "saida",
      valor,
      descricao: `Transferência para ${destino.nome}`,
      data: new Date().toISOString(),
    };
    const entrada: MovimentacaoContaBancaria = {
      id: `mov-${ts}-e`,
      contaId: destino.id,
      tipo: "entrada",
      valor,
      descricao: `Transferência de ${modalTransferir.nome}`,
      data: new Date().toISOString(),
    };
    persistirMovs([...movimentacoes, saida, entrada]);
    setModalTransferir(null);
    setValorTransf("");
    setContaDestinoId("");
  }

  const contaPodeExcluir = (conta: ContaBancaria) =>
    ![
      ID_CONTA_CAIXA,
      ID_CONTA_CARTEIRA,
      ID_CONTA_NF,
    ].includes(conta.id);

  function excluirContaEditada() {
    if (!modalEditar || !contaPodeExcluir(modalEditar)) return;
    persistirContas(
      contas.map((c) =>
        c.id === modalEditar.id ? { ...c, excluida: true } : c
      )
    );
    setModalEditar(null);
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
              linhas.map(({ conta, saldo }, index) => (
                <tr
                  key={conta.id}
                  className={cn(
                    "border-b border-[#ececec] text-[13px] dark:border-slate-700",
                    index % 2 === 1
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
                      saldo > 0
                        ? "text-[#4cae4c] dark:text-emerald-400"
                        : "text-slate-500 dark:text-slate-400"
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
                            onClick={() => setModalExtrato(conta)}
                            className="inline-flex h-8 w-8 items-center justify-center text-slate-500 hover:text-[#4a90d9] dark:text-slate-400 dark:hover:text-sky-300"
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
                            title="Transferir"
                            onClick={() => {
                              setModalTransferir(conta);
                              setContaDestinoId("");
                              setValorTransf("");
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center text-slate-500 hover:text-[#4a90d9] dark:text-slate-400 dark:hover:text-sky-300"
                          >
                            <ArrowLeftRight className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setModalAcao({
                                conta,
                                acao: conta.acaoPrincipal,
                              });
                              setValorMov("");
                              setDescMov("");
                            }}
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
              ))
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
            ? excluirContaEditada
            : undefined
        }
      />

      <ModalSimples
        titulo={`Transferir — ${modalTransferir?.nome ?? ""}`}
        open={modalTransferir !== null}
        onClose={() => setModalTransferir(null)}
        footer={
          <>
            <button
              type="button"
              onClick={confirmarTransferencia}
              className="rounded bg-[#4a90d9] px-4 py-2 text-[13px] text-white"
            >
              Transferir
            </button>
            <button
              type="button"
              onClick={() => setModalTransferir(null)}
              className="rounded border px-4 py-2 text-[13px]"
            >
              Fechar
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[12px]">Conta destino</label>
            <select
              value={contaDestinoId}
              onChange={(e) => setContaDestinoId(e.target.value)}
              className={inputClass}
            >
              <option value="">Selecione</option>
              {contas
                .filter((c) => !c.excluida && c.id !== modalTransferir?.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[12px]">Valor</label>
            <input
              type="text"
              value={valorTransf}
              onChange={(e) => setValorTransf(e.target.value)}
              placeholder="0,00"
              className={inputClass}
            />
          </div>
        </div>
      </ModalSimples>

      <ModalSimples
        titulo={
          modalAcao
            ? `${labelAcaoConta(modalAcao.acao)} — ${modalAcao.conta.nome}`
            : ""
        }
        open={modalAcao !== null}
        onClose={() => setModalAcao(null)}
        footer={
          <>
            <button
              type="button"
              onClick={confirmarAcaoConta}
              className="rounded bg-[#4cae4c] px-4 py-2 text-[13px] text-white"
            >
              Confirmar
            </button>
            <button
              type="button"
              onClick={() => setModalAcao(null)}
              className="rounded border px-4 py-2 text-[13px]"
            >
              Fechar
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[12px]">Valor</label>
            <input
              type="text"
              value={valorMov}
              onChange={(e) => setValorMov(e.target.value)}
              placeholder="0,00"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px]">Descrição</label>
            <input
              type="text"
              value={descMov}
              onChange={(e) => setDescMov(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </ModalSimples>

      <ExtratoBancarioModal
        conta={modalExtrato}
        open={modalExtrato !== null}
        onClose={() => setModalExtrato(null)}
        onContaAtualizada={atualizarContaNaLista}
      />

      <ConciliacaoContaModal
        open={modalConciliar}
        onClose={() => setModalConciliar(false)}
        contas={contas}
        onImportarExtrato={(contaId, movimentacoes) => {
          salvarExtratoBancario(
            mesclarExtrato(carregarExtratoBancario(), movimentacoes)
          );
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
