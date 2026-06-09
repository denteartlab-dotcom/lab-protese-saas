"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Upload, User } from "lucide-react";
import type { ContaBancaria } from "@/lib/conta-bancaria";
import type { ExtratoMovimentacao } from "@/lib/extrato-bancario";
import {
  contaOfxCombina,
  dadosOfxParaFormCadastro,
  movimentacoesOfxParaExtrato,
  parseOfxArquivo,
  resumirDescricaoOfx,
  type MovimentacaoOfx,
  type OfxParseResult,
} from "@/lib/extrato-ofx";
import { cn } from "@/lib/utils";
import type { DadosFormContaBancaria } from "@/lib/conta-bancaria";

type ExtratoPendente = Omit<ExtratoMovimentacao, "contaId">[];

type Props = {
  open: boolean;
  onClose: () => void;
  contas: ContaBancaria[];
  onImportarExtrato: (contaId: string, movimentacoes: ExtratoMovimentacao[]) => void;
  onAbrirCadastro: (form: DadosFormContaBancaria, extrato: ExtratoPendente) => void;
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

const thClass =
  "border-b border-[#e0e0e0] bg-[#f5f6f8] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500";

export function ConciliacaoContaModal({
  open,
  onClose,
  contas,
  onImportarExtrato,
  onAbrirCadastro,
}: Props) {
  const [portalPronto, setPortalPronto] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<OfxParseResult | null>(null);
  const [erroLeitura, setErroLeitura] = useState("");
  const [lendo, setLendo] = useState(false);
  const [resumirDescricao, setResumirDescricao] = useState(true);
  const [todasContas, setTodasContas] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setPortalPronto(true), []);

  useEffect(() => {
    if (!open) return;
    setArquivo(null);
    setParseResult(null);
    setErroLeitura("");
    setResumirDescricao(true);
    setTodasContas(true);
  }, [open]);

  const contaEncontrada = useMemo(() => {
    if (!parseResult) return null;
    return (
      contas.find((c) => contaOfxCombina(c, parseResult.dadosConta)) ?? null
    );
  }, [contas, parseResult]);

  const contaNaoCadastrada = Boolean(
    parseResult &&
      parseResult.dadosConta.numeroConta.trim() &&
      !contaEncontrada
  );

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

  async function processarArquivo() {
    if (!arquivo) {
      setErroLeitura("Selecione o arquivo OFX.");
      return;
    }
    const nome = arquivo.name.toLowerCase();
    if (!nome.endsWith(".ofx") && !nome.endsWith(".qfx")) {
      setErroLeitura("Somente arquivos OFX são aceitos.");
      return;
    }

    setLendo(true);
    setErroLeitura("");
    setParseResult(null);

    try {
      const texto = await arquivo.text();
      const resultado = parseOfxArquivo(texto);
      if (resultado.movimentacoes.length === 0 && !resultado.dadosConta.numeroConta) {
        setErroLeitura("Não foi possível ler movimentações no arquivo OFX.");
        return;
      }
      setParseResult(resultado);
    } catch {
      setErroLeitura("Falha ao ler o arquivo OFX.");
    } finally {
      setLendo(false);
    }
  }

  function abrirCadastroPreenchido() {
    if (!parseResult) return;
    const form = dadosOfxParaFormCadastro(parseResult.dadosConta);
    if (!form.nome.trim()) {
      form.nome = `Conta ${form.codBanco || ""} ${form.numeroConta}`.trim();
    }
    onAbrirCadastro(form, extratoPendenteAtual());
  }

  function confirmarCadastro() {
    if (!parseResult) return;
    if (contaEncontrada) {
      const movs = movimentacoesOfxParaExtrato(linhasTabela, contaEncontrada.id).map(
        (m) => ({
          ...m,
          descricao: resumirDescricao
            ? resumirDescricaoOfx(m.descricao)
            : m.descricao,
        })
      );
      onImportarExtrato(contaEncontrada.id, movs);
      onClose();
      return;
    }
    abrirCadastroPreenchido();
  }

  if (!open || !portalPronto) return null;

  const dados = parseResult?.dadosConta;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conciliacao-conta-titulo"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div
        className="relative my-auto w-full max-w-[1100px] rounded border border-[#d4d4d4] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.2)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[#e5e5e5] px-4 py-3">
          <h2
            id="conciliacao-conta-titulo"
            className="text-[15px] font-normal text-slate-800"
          >
            Conciliação de Conta
          </h2>
        </div>

        <div className="space-y-4 px-4 py-4">
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
                  setArquivo(file);
                  setParseResult(null);
                  setErroLeitura("");
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="min-w-0 flex-1 truncate px-3 py-2.5 text-left text-[13px] text-slate-500 hover:bg-slate-50"
              >
                {arquivo?.name ?? "Selecione o arquivo OFX"}
              </button>
              <button
                type="button"
                onClick={() => void processarArquivo()}
                disabled={lendo || !arquivo}
                className="inline-flex shrink-0 items-center gap-1.5 border-l border-[#d4d4d4] bg-white px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                {lendo ? "Lendo..." : "Upload"}
              </button>
            </div>
            {erroLeitura ? (
              <p className="mt-1.5 text-[12px] text-red-600">{erroLeitura}</p>
            ) : null}
            {contaNaoCadastrada ? (
              <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                <p>Conta não está cadastrada no sistema.</p>
                <button
                  type="button"
                  onClick={abrirCadastroPreenchido}
                  className="mt-1 font-medium text-[#4a90d9] underline hover:text-[#3d7fc4]"
                >
                  Cadastrar conta
                </button>
              </div>
            ) : null}
            {parseResult && contaEncontrada ? (
              <p className="mt-1.5 text-[12px] text-[#4cae4c]">
                Conta identificada: <strong>{contaEncontrada.nome}</strong>
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
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 px-3 py-3 text-[12px] md:grid-cols-5">
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
                  <p className="font-semibold text-[#4cae4c]">
                    {money(dados.saldo)}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="max-h-[340px] overflow-auto rounded border border-[#e5e5e5]">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead className="sticky top-0 z-[1]">
                <tr>
                  <th className={thClass}>Data</th>
                  <th className={thClass}>Descrição</th>
                  <th className={thClass}>Forma</th>
                  <th className={cn(thClass, "text-right")}>Valor</th>
                  <th className={thClass}>Tipo</th>
                  <th className={thClass}>Procedimento</th>
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
                        : "Faça o upload de um arquivo OFX para visualizar as movimentações."}
                    </td>
                  </tr>
                ) : (
                  linhasTabela.map((linha) => {
                    const descricao = resumirDescricao
                      ? resumirDescricaoOfx(linha.descricao)
                      : linha.descricao;
                    return (
                      <tr
                        key={linha.id}
                        className="border-b border-[#f0f0f0] text-[12px] text-slate-700"
                      >
                        <td className="whitespace-nowrap px-3 py-2">
                          {formatData(linha.data)}
                        </td>
                        <td className="max-w-[280px] px-3 py-2">{descricao}</td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {linha.forma}
                        </td>
                        <td
                          className={cn(
                            "px-3 py-2 text-right tabular-nums",
                            linha.tipo === "credito"
                              ? "text-[#4cae4c]"
                              : "text-red-600"
                          )}
                        >
                          {linha.tipo === "debito" ? "-" : ""}
                          {money(linha.valor)}
                        </td>
                        <td className="px-3 py-2">
                          {linha.tipo === "credito" ? "Crédito" : "Débito"}
                        </td>
                        <td className="px-3 py-2 text-slate-400">—</td>
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
            onClick={confirmarCadastro}
            disabled={!parseResult}
            className="h-9 rounded border border-[#4a90d9] bg-[#4a90d9] px-5 text-[13px] text-white hover:bg-[#3d7fc4] disabled:opacity-50"
          >
            Cadastrar
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
}
