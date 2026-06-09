"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, Upload, User, X } from "lucide-react";
import type { ContaBancaria } from "@/lib/conta-bancaria";
import type { ExtratoMovimentacao } from "@/lib/extrato-bancario";
import { salvarConciliacaoNaConta } from "@/lib/conciliacao-ofx-salvar";
import {
  montarOpcoesProcedimentoPorTipo,
  sugerirProcedimento,
  type LancamentoConciliacao,
} from "@/lib/conciliacao-ofx-procedimento";
import {
  contaOfxCombina,
  dadosOfxParaFormCadastro,
  resumirDescricaoOfx,
  type MovimentacaoOfx,
  type OfxParseResult,
} from "@/lib/extrato-ofx";
import { cn } from "@/lib/utils";
import type { DadosFormContaBancaria } from "@/lib/conta-bancaria";
import {
  LancarDespesaModal,
  LancarReceitaModal,
  type LancarReceitaPayload,
} from "@/components/financeiro/LancarReceitaModal";
import {
  labelProcedimentoLinha,
  montarConciliacaoInicial,
  salvarLancamentoProcedimento,
} from "@/lib/conciliacao-lancamento";
import { persistirContasBancariasApi } from "@/lib/conta-bancaria-api";

type ExtratoPendente = Omit<ExtratoMovimentacao, "contaId">[];

type ClienteOpt = { id: string; nome: string };

type Props = {
  open: boolean;
  onClose: () => void;
  contas: ContaBancaria[];
  lancamentos: LancamentoConciliacao[];
  clientes?: ClienteOpt[];
  onConciliacaoSalva: () => void | Promise<void>;
  onAbrirCadastro: (form: DadosFormContaBancaria, extrato: ExtratoPendente) => void;
  onLancamentoCriado?: (lancamento: LancamentoConciliacao) => void;
};

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatData(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-600">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-[#4cae4c]" : "bg-slate-300"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
            checked ? "left-[18px]" : "left-0.5"
          )}
        />
      </button>
      <span>{label}</span>
    </label>
  );
}

const FORMAS_CONHECIDAS = new Set([
  "PIX",
  "TED",
  "DOC",
  "Boleto",
  "Dinheiro",
  "Cartão",
  "Transferência",
]);

function CelulaForma({ forma }: { forma: string }) {
  const valor = forma.trim();
  if (!valor || !FORMAS_CONHECIDAS.has(valor)) {
    return (
      <span className="text-[11px] text-slate-400" title="Sem forma de pagamento">
        —
      </span>
    );
  }
  if (valor === "PIX") {
    return (
      <span
        className="inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded bg-[#32bcad] px-1 text-[8px] font-bold uppercase tracking-tight text-white"
        title="PIX"
      >
        pix
      </span>
    );
  }
  return (
    <span className="text-[11px] text-slate-600" title={valor}>
      {valor}
    </span>
  );
}

const thClass =
  "border-b border-[#e0e0e0] bg-[#f5f6f8] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500";

export function ConciliacaoContaModal({
  open,
  onClose,
  contas,
  lancamentos,
  clientes = [],
  onConciliacaoSalva,
  onAbrirCadastro,
  onLancamentoCriado,
}: Props) {
  const [portalPronto, setPortalPronto] = useState(false);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [parseResult, setParseResult] = useState<OfxParseResult | null>(null);
  const [erroLeitura, setErroLeitura] = useState("");
  const [lendo, setLendo] = useState(false);
  const [resumirDescricao, setResumirDescricao] = useState(true);
  const [todasContas, setTodasContas] = useState(true);
  const [procedimentos, setProcedimentos] = useState<Record<string, string>>({});
  const [procedimentoLabels, setProcedimentoLabels] = useState<
    Record<string, string>
  >({});
  const [linhaProcedimento, setLinhaProcedimento] =
    useState<MovimentacaoOfx | null>(null);
  const [salvandoProcedimento, setSalvandoProcedimento] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [contaIdentificadaId, setContaIdentificadaId] = useState<string | null>(
    null
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const arquivoRef = useRef<File | null>(null);

  useEffect(() => setPortalPronto(true), []);

  useEffect(() => {
    if (!open) return;
    setNomeArquivo("");
    setParseResult(null);
    setErroLeitura("");
    setResumirDescricao(true);
    setTodasContas(true);
    setProcedimentos({});
    setProcedimentoLabels({});
    setLinhaProcedimento(null);
    arquivoRef.current = null;
  }, [open]);

  const contaEncontrada = useMemo(() => {
    if (!parseResult) return null;
    if (contaIdentificadaId) {
      const porId = contas.find((c) => c.id === contaIdentificadaId);
      if (porId) return porId;
    }
    return contas.find((c) => contaOfxCombina(c, parseResult.dadosConta)) ?? null;
  }, [contas, parseResult, contaIdentificadaId]);

  const numeroContaOfx = parseResult?.dadosConta.numeroConta.trim() ?? "";
  const contaNaoCadastrada = Boolean(parseResult && numeroContaOfx && !contaEncontrada);

  const linhasTabela = useMemo(() => {
    if (!parseResult) return [] as MovimentacaoOfx[];
    let movs = parseResult.movimentacoes;
    if (!todasContas && parseResult.dadosConta.numeroConta) {
      const banco = parseResult.dadosConta.codBanco;
      const ag = parseResult.dadosConta.agencia;
      const num = parseResult.dadosConta.numeroConta;
      movs = movs.filter((m) => {
        if (!m.contaNumero) return true;
        return contaOfxCombina(
          { codBanco: m.contaBanco, agencia: m.contaAgencia, numeroConta: m.contaNumero },
          { nomeTitular: "", codBanco: banco, agencia: ag, numeroConta: num, saldo: 0 }
        );
      });
    }
    return movs;
  }, [parseResult, todasContas]);

  const aplicarSugestoesProcedimento = useCallback(
    (linhas: MovimentacaoOfx[]) => {
      const sugestoes: Record<string, string> = {};
      for (const linha of linhas) {
        const sugerido = sugerirProcedimento(linha, lancamentos);
        if (sugerido) sugestoes[linha.id] = sugerido;
      }
      setProcedimentos(sugestoes);
    },
    [lancamentos]
  );

  const lerArquivoOfx = useCallback(
    async (file: File) => {
      const nome = file.name.toLowerCase();
      if (!nome.endsWith(".ofx") && !nome.endsWith(".qfx")) {
        setErroLeitura("Somente arquivos OFX são aceitos.");
        setParseResult(null);
        return;
      }

      setLendo(true);
      setErroLeitura("");
      setParseResult(null);
      setProcedimentos({});

      try {
        const form = new FormData();
        form.append("arquivo", file);
        const res = await fetch("/api/contas-bancarias/ofx", {
          method: "POST",
          body: form,
        });
        const json = (await res.json().catch(() => ({}))) as {
          error?: string;
          parseResult?: OfxParseResult;
          contaEncontrada?: ContaBancaria | null;
          contaNaoCadastrada?: boolean;
        };

        if (!res.ok) {
          setErroLeitura(json.error || "Falha ao ler o arquivo OFX.");
          return;
        }

        const resultado = json.parseResult;
        if (
          !resultado ||
          (resultado.movimentacoes.length === 0 &&
            !resultado.dadosConta.numeroConta)
        ) {
          setErroLeitura("Não foi possível ler movimentações no arquivo OFX.");
          return;
        }

        setParseResult(resultado);
        setContaIdentificadaId(json.contaEncontrada?.id ?? null);
        aplicarSugestoesProcedimento(resultado.movimentacoes);
      } catch {
        setErroLeitura("Falha ao ler o arquivo OFX.");
      } finally {
        setLendo(false);
      }
    },
    [aplicarSugestoesProcedimento]
  );

  function extratoPendenteAtual(): ExtratoPendente {
    if (!parseResult) return [];
    return linhasTabela.map((linha) => ({
      id: linha.fitid || linha.id,
      tipo: linha.tipo === "credito" ? "entrada" : "saida",
      valor: linha.valor,
      descricao: resumirDescricao
        ? resumirDescricaoOfx(linha.descricao)
        : linha.descricao,
      data: linha.data,
      origem: "arquivo" as const,
      idExterno: linha.fitid || linha.id,
    }));
  }

  async function handleSelecionarArquivo(file: File | null) {
    if (!file) return;
    arquivoRef.current = file;
    setNomeArquivo(file.name);
    await lerArquivoOfx(file);
  }

  function abrirCadastroPreenchido() {
    if (!parseResult) return;
    const form = dadosOfxParaFormCadastro(parseResult.dadosConta);
    if (!form.nome.trim()) {
      form.nome = `Conta ${form.codBanco || ""} ${form.numeroConta}`.trim();
    }
    onAbrirCadastro(form, extratoPendenteAtual());
  }

  function abrirProcedimento(linha: MovimentacaoOfx) {
    setLinhaProcedimento(linha);
  }

  async function salvarProcedimentoModal(payload: LancarReceitaPayload) {
    if (!linhaProcedimento || salvandoProcedimento) return;
    const contaNome =
      contaEncontrada?.nome ||
      conciliacaoInicialContaNome() ||
      payload.parcelas[0]?.conta ||
      "Conta Bancária";
    const modo = linhaProcedimento.tipo === "credito" ? "receita" : "despesa";

    setSalvandoProcedimento(true);
    try {
      const { id, label } = await salvarLancamentoProcedimento(
        payload,
        modo,
        contaNome
      );
      setProcedimentos((atual) => ({
        ...atual,
        [linhaProcedimento.id]: id,
      }));
      setProcedimentoLabels((atual) => ({
        ...atual,
        [linhaProcedimento.id]: label,
      }));
      onLancamentoCriado?.({
        id,
        tipo: modo,
        descricao: label,
        valor: linhaProcedimento.valor,
        data: linhaProcedimento.data,
        status: "pago",
      });
      setLinhaProcedimento(null);
    } catch (err) {
      setErroLeitura(
        err instanceof Error ? err.message : "Não foi possível salvar o lançamento."
      );
    } finally {
      setSalvandoProcedimento(false);
    }
  }

  function conciliacaoInicialContaNome() {
    if (contaEncontrada) return contaEncontrada.nome;
    if (!parseResult?.dadosConta.numeroConta) return "Conta Bancária";
    const match = contas.find((c) =>
      contaOfxCombina(c, parseResult.dadosConta)
    );
    return match?.nome || "Conta Bancária";
  }

  async function confirmarCadastro() {
    if (!parseResult || salvando) return;
    if (!contaEncontrada) {
      abrirCadastroPreenchido();
      return;
    }

    setSalvando(true);
    try {
      const movimentacoes = await salvarConciliacaoNaConta({
        conta: contaEncontrada,
        linhas: linhasTabela,
        procedimentos,
        lancamentos,
        resumirDescricao,
      });

      if (movimentacoes.length > 0) {
        const { mesclarExtrato, carregarExtratoBancario, salvarExtratoBancario } =
          await import("@/lib/extrato-bancario");
        const extrato = mesclarExtrato(
          carregarExtratoBancario(),
          movimentacoes
        );
        salvarExtratoBancario(extrato);
        await persistirContasBancariasApi({ extrato });
      }

      await onConciliacaoSalva();
      onClose();
    } catch (err) {
      setErroLeitura(
        err instanceof Error ? err.message : "Não foi possível salvar a conciliação."
      );
    } finally {
      setSalvando(false);
    }
  }

  if (!open || !portalPronto) return null;

  const dados = parseResult?.dadosConta;

  const modalProcedimento = linhaProcedimento ? (
    linhaProcedimento.tipo === "credito" ? (
      <LancarReceitaModal
        open
        onClose={() => setLinhaProcedimento(null)}
        onSubmit={salvarProcedimentoModal}
        entidades={clientes}
        variante="conciliacao-smart"
        conciliacaoInicial={montarConciliacaoInicial(
          linhaProcedimento,
          conciliacaoInicialContaNome(),
          resumirDescricao
        )}
        contasBancarias={contas
          .filter((c) => !c.excluida)
          .map((c) => ({ nome: c.nome }))}
        overlayZIndex={10001}
        salvando={salvandoProcedimento}
      />
    ) : (
      <LancarDespesaModal
        open
        onClose={() => setLinhaProcedimento(null)}
        onSubmit={salvarProcedimentoModal}
        entidades={clientes}
        variante="conciliacao-smart"
        conciliacaoInicial={montarConciliacaoInicial(
          linhaProcedimento,
          conciliacaoInicialContaNome(),
          resumirDescricao
        )}
        contasBancarias={contas
          .filter((c) => !c.excluida)
          .map((c) => ({ nome: c.nome }))}
        overlayZIndex={10001}
        salvando={salvandoProcedimento}
      />
    )
  ) : null;

  const portalConciliacao = createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conciliacao-conta-titulo"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div
        className="relative my-auto flex min-h-[min(88vh,900px)] w-full max-w-[min(1480px,94vw)] flex-col rounded border border-[#d4d4d4] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.2)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#e5e5e5] px-4 py-3">
          <h2
            id="conciliacao-conta-titulo"
            className="text-[15px] font-normal text-slate-800"
          >
            Conciliação de Conta
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

        <div className="flex flex-1 flex-col space-y-4 px-4 py-4">
          <div>
            <label className="mb-1.5 block text-[12px] text-slate-700">
              Extrato Bancário
            </label>
            <div className="flex overflow-hidden rounded border border-[#d4d4d4]">
              <input
                ref={inputRef}
                type="file"
                accept=".ofx,.qfx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  void handleSelecionarArquivo(file);
                  e.target.value = "";
                }}
              />
              <input
                type="text"
                readOnly
                value={lendo ? "Lendo arquivo OFX..." : nomeArquivo || "Selecione o arquivo OFX"}
                onClick={() => inputRef.current?.click()}
                className="min-w-0 flex-1 cursor-pointer border-0 bg-white px-3 py-2.5 text-[13px] text-slate-700 outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  if (arquivoRef.current) {
                    void lerArquivoOfx(arquivoRef.current);
                  } else {
                    inputRef.current?.click();
                  }
                }}
                disabled={lendo}
                className="inline-flex shrink-0 items-center gap-1.5 border-l border-[#d4d4d4] bg-white px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                {lendo ? "Lendo..." : "Upload"}
              </button>
            </div>
            {erroLeitura ? (
              <p className="mt-1.5 text-[12px] text-red-600">{erroLeitura}</p>
            ) : null}
            {contaNaoCadastrada && dados ? (
              <div
                className="mt-3 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-[12px] text-amber-950"
                role="alert"
              >
                <p className="font-medium">
                  Conta bancária não cadastrada no banco de dados
                </p>
                <p className="mt-1 text-amber-900">
                  O extrato OFX pertence à conta{" "}
                  <strong>
                    {dados.codBanco ? `banco ${dados.codBanco}` : "—"}
                    {dados.agencia ? ` · ag. ${dados.agencia}` : ""}
                    {dados.numeroConta ? ` · nº ${dados.numeroConta}` : ""}
                  </strong>
                  , que ainda não está vinculada às contas cadastradas.
                </p>
                <button
                  type="button"
                  onClick={abrirCadastroPreenchido}
                  className="mt-2 inline-flex items-center rounded border border-[#4a90d9] bg-[#4a90d9] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#3d7fc4]"
                >
                  Cadastrar nova conta
                </button>
              </div>
            ) : null}
            {parseResult && contaEncontrada ? (
              <p className="mt-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900">
                Conta identificada no banco de dados:{" "}
                <strong>{contaEncontrada.nome}</strong>
                {contaEncontrada.numeroConta
                  ? ` (nº ${contaEncontrada.numeroConta})`
                  : ""}
              </p>
            ) : null}
          </div>

          {dados ? (
            <div className="rounded border border-[#e5e5e5] bg-[#fafafa]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e5e5] px-3 py-2.5">
                <div className="flex items-center gap-2 text-[12px] font-medium text-slate-700">
                  <User className="h-4 w-4 text-slate-400" />
                  Dados do Arquivo
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <Toggle
                    checked={resumirDescricao}
                    onChange={setResumirDescricao}
                    label="Resumir Descrição"
                  />
                  <Toggle
                    checked={todasContas}
                    onChange={setTodasContas}
                    label="Lançamento de todas as contas bancarias"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-x-8 gap-y-2 px-3 py-3 text-[12px]">
                <div>
                  <span className="text-slate-500">Nome</span>
                  <p className="font-medium text-slate-800">
                    {dados.nomeTitular || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Cód. Banco</span>
                  <p className="font-medium text-slate-800">
                    {dados.codBanco || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Agência</span>
                  <p className="font-medium text-slate-800">
                    {dados.agencia || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Número Conta</span>
                  <p className="font-medium text-slate-800">
                    {dados.numeroConta || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">SALDO</span>
                  <p className="text-[13px] font-semibold text-[#4cae4c]">
                    {money(dados.saldo)}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-auto rounded border border-[#e5e5e5]">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead className="sticky top-0 z-[1]">
                <tr>
                  <th className={thClass}>Data</th>
                  <th className={thClass}>Descrição</th>
                  <th className={cn(thClass, "w-16 text-center")}>Forma</th>
                  <th className={cn(thClass, "text-right")}>Valor</th>
                  <th className={cn(thClass, "w-24 text-center")}>Tipo</th>
                  <th className={cn(thClass, "min-w-[280px]")}>Procedimento</th>
                </tr>
              </thead>
              <tbody>
                {linhasTabela.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-[13px] text-slate-400"
                    >
                      {parseResult
                        ? "Nenhuma movimentação encontrada no arquivo."
                        : "Selecione um arquivo OFX para visualizar as movimentações."}
                    </td>
                  </tr>
                ) : (
                  linhasTabela.map((linha, index) => {
                    const descricao = resumirDescricao
                      ? resumirDescricaoOfx(linha.descricao)
                      : linha.descricao;
                    const credito = linha.tipo === "credito";
                    return (
                      <tr
                        key={linha.id}
                        className={cn(
                          "border-b border-[#ececec] text-[12px] text-slate-700",
                          index % 2 === 1 ? "bg-[#fafafa]" : "bg-white"
                        )}
                      >
                        <td className="whitespace-nowrap px-3 py-2">
                          {formatData(linha.data)}
                        </td>
                        <td className="max-w-[300px] px-3 py-2">{descricao}</td>
                        <td className="px-3 py-2 text-center">
                          <CelulaForma forma={linha.forma} />
                        </td>
                        <td
                          className={cn(
                            "px-3 py-2 text-right font-medium tabular-nums",
                            credito ? "text-[#4cae4c]" : "text-[#dc2626]"
                          )}
                        >
                          {money(linha.valor)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={cn(
                              "inline-block rounded px-2 py-0.5 text-[10px] font-semibold text-white",
                              credito ? "bg-[#4cae4c]" : "bg-[#dc2626]"
                            )}
                          >
                            {linha.tipoBadge}
                          </span>
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex min-w-[300px] gap-1">
                            <button
                              type="button"
                              onClick={() => abrirProcedimento(linha)}
                              className="flex h-8 min-w-0 flex-1 items-center rounded border border-[#d4d4d4] bg-white px-2 text-left text-[11px] text-slate-700 hover:border-[#4a90d9] focus:border-[#4a90d9] focus:outline-none"
                              title={
                                credito
                                  ? "Lançar ou vincular receita"
                                  : "Lançar ou vincular despesa"
                              }
                            >
                              <span className="truncate">
                                {procedimentos[linha.id]
                                  ? labelProcedimentoLinha(
                                      linha.id,
                                      procedimentos[linha.id],
                                      linha.tipo,
                                      lancamentos,
                                      procedimentoLabels
                                    )
                                  : credito
                                    ? "Vincular receita..."
                                    : "Vincular despesa..."}
                              </span>
                            </button>
                            <select
                              value={procedimentos[linha.id] ?? ""}
                              onChange={(e) => {
                                const valor = e.target.value;
                                setProcedimentos((atual) => ({
                                  ...atual,
                                  [linha.id]: valor,
                                }));
                                if (!valor) {
                                  setProcedimentoLabels((atual) => {
                                    const next = { ...atual };
                                    delete next[linha.id];
                                    return next;
                                  });
                                }
                              }}
                              className="h-8 w-8 shrink-0 cursor-pointer rounded border border-[#d4d4d4] bg-[#f5f6f8] px-0 text-center text-[10px] text-slate-500"
                              title="Vincular lançamento existente"
                              aria-label="Vincular lançamento existente"
                            >
                              <option value="">▼</option>
                              {montarOpcoesProcedimentoPorTipo(
                                linha.tipo,
                                lancamentos
                              ).map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex gap-2 border-t border-[#e5e5e5] px-4 py-3">
          <button
            type="button"
            onClick={() => void confirmarCadastro()}
            disabled={!parseResult || lendo || salvando}
            className="h-9 rounded border border-[#4a90d9] bg-[#4a90d9] px-5 text-[13px] text-white hover:bg-[#3d7fc4] disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Cadastrar"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded border border-[#d4d4d4] bg-white px-5 text-[13px] text-slate-700 hover:bg-slate-50"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <>
      {portalConciliacao}
      {modalProcedimento}
    </>
  );
}
