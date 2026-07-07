"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  Shield,
  Wallet,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui";
import { AsaasSeloInstitucional } from "@/components/AsaasSeloInstitucional";
import { ConfirmarPixSubcontaModal } from "@/components/financeiro/ConfirmarPixSubcontaModal";
import { analisarCaminhoApp, montarCaminhoAppComSlug } from "@/lib/rotas-app";
import { fetchPainelFinanceiro } from "@/lib/financeiro-painel-cliente";
import type { PainelFinanceiroContaDigital } from "@/lib/financeiro-painel-types";
import type { ResumoLimitePixContaDigital } from "@/lib/conta-digital-pix-limite";
import { parseCurrencyBr } from "@/lib/cliente-financeiro";
import { cn } from "@/lib/utils";
import type { TipoMensagemForm } from "@/components/DadosLaboratorioForm";

type StatusSubconta =
  | "nao_iniciado"
  | "pendente_documentos"
  | "em_analise"
  | "aprovada"
  | "reprovada";

type DocumentoOnboarding = {
  id: string;
  title: string;
  description?: string;
  status?: string;
  onboardingUrl?: string | null;
};

type SubcontaResumo = {
  status: StatusSubconta;
  contaAtiva?: boolean;
  modoIntegracao?: "subconta" | "legado" | null;
  agencia?: string | null;
  conta?: string | null;
  contaDigito?: string | null;
};

const labelClass = "mb-1 block text-[11px] font-medium text-slate-600";
const inputClass =
  "h-9 w-full rounded border border-slate-300 bg-white px-2.5 text-[12px] text-slate-800 outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]";

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatCurrencyInput(value: string) {
  return money(Number(value.replace(/\D/g, "")) / 100);
}

function mensagemTransferenciaPix(
  modo: SubcontaResumo["modoIntegracao"],
  status?: string | null
) {
  const pendente = !status || status === "PENDING" || status === "BANK_PROCESSING";
  if (modo === "legado" && pendente) {
    return "Transferência solicitada. Aprove no site ou app do Asaas (autorização crítica) para concluir.";
  }
  if (modo === "subconta" && pendente) {
    return "Transferência Pix solicitada. Aguardando processamento pelo Asaas.";
  }
  if (status === "DONE") return "Transferência Pix concluída.";
  return "Transferência Pix solicitada.";
}

function rotuloStatus(status: StatusSubconta) {
  switch (status) {
    case "aprovada":
      return { texto: "Conta aprovada", cor: "text-emerald-700 bg-emerald-50 border-emerald-200" };
    case "em_analise":
      return { texto: "Em análise", cor: "text-amber-700 bg-amber-50 border-amber-200" };
    case "reprovada":
      return { texto: "Reprovada", cor: "text-red-700 bg-red-50 border-red-200" };
    case "pendente_documentos":
      return { texto: "Documentos pendentes", cor: "text-blue-700 bg-blue-50 border-blue-200" };
    default:
      return { texto: "Não iniciada", cor: "text-slate-600 bg-slate-50 border-slate-200" };
  }
}

function linkConfiguracoes(pathname: string) {
  const { slug } = analisarCaminhoApp(pathname);
  if (slug) return montarCaminhoAppComSlug(slug, "/configuracoes?aba=boletos");
  return "/app/configuracoes?aba=boletos";
}

export type ContaDigitalAba = "extrato" | "pagar" | "transferir";

type Props = {
  /** Quando embutido na página Conta Bancária. */
  embedded?: boolean;
  /** Abre a aba solicitada (ex.: transferir ao clicar em Retirar). */
  abaSolicitada?: ContaDigitalAba | null;
};

export function ContaDigitalConteudo({
  embedded = false,
  abaSolicitada = null,
}: Props = {}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [subconta, setSubconta] = useState<SubcontaResumo | null>(null);
  const [saldo, setSaldo] = useState(0);
  const [movimentacoes, setMovimentacoes] = useState<
    Array<{
      id: string;
      date: string;
      type: string;
      value: number;
      description: string;
      balance: number;
    }>
  >([]);
  const [aba, setAba] = useState<"extrato" | "pagar" | "transferir">("extrato");
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; tipo: TipoMensagemForm } | null>(
    null
  );

  const [linhaDigitavel, setLinhaDigitavel] = useState("");
  const [boletoValidado, setBoletoValidado] = useState<{
    valor: number;
    vencimento?: string;
    beneficiario?: string;
    taxa?: number;
  } | null>(null);
  const [valorPix, setValorPix] = useState("");
  const [chavePix, setChavePix] = useState("");
  const [tipoChave, setTipoChave] = useState<"CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP">("EVP");
  const [modalPixSubconta, setModalPixSubconta] = useState(false);
  const [erroModalPix, setErroModalPix] = useState<string | null>(null);
  const [limitePix, setLimitePix] = useState<ResumoLimitePixContaDigital>({
    ativo: false,
    limiteDiario: null,
    usadoHoje: 0,
    disponivelHoje: null,
  });
  const [limiteAtivoForm, setLimiteAtivoForm] = useState(false);
  const [limiteValorForm, setLimiteValorForm] = useState("");
  const [salvandoLimite, setSalvandoLimite] = useState(false);
  const [podeConfigurarLimite, setPodeConfigurarLimite] = useState(false);

  const carregar = useCallback(async (opts?: { refresh?: boolean }) => {
    setCarregando(true);
    try {
      const painel = await fetchPainelFinanceiro<PainelFinanceiroContaDigital>(
        "conta-digital",
        opts
      );
      if (!painel.ok) throw new Error(painel.error);
      setSubconta((painel.dados.subconta as SubcontaResumo) || null);
      setSaldo(Number(painel.dados.saldo) || 0);
      setMovimentacoes(painel.dados.movimentacoes || []);
      if (painel.dados.limitePix) {
        setLimitePix(painel.dados.limitePix);
        setLimiteAtivoForm(Boolean(painel.dados.limitePix.ativo));
        setLimiteValorForm(
          painel.dados.limitePix.limiteDiario
            ? money(painel.dados.limitePix.limiteDiario)
            : ""
        );
      }
    } catch (err) {
      setMensagem({
        texto: err instanceof Error ? err.message : "Erro ao carregar.",
        tipo: "erro",
      });
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (searchParams.get("acao") === "transferir") {
      setAba("transferir");
    } else if (searchParams.get("acao") === "pagar") {
      setAba("pagar");
    }
  }, [searchParams]);

  useEffect(() => {
    if (abaSolicitada) setAba(abaSolicitada);
  }, [abaSolicitada]);

  useEffect(() => {
    void fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((json: { acessoTotal?: boolean }) => {
        setPodeConfigurarLimite(Boolean(json.acessoTotal));
      })
      .catch(() => setPodeConfigurarLimite(false));
  }, []);

  async function salvarLimitePix() {
    setSalvandoLimite(true);
    setMensagem(null);
    try {
      const limiteDiario = limiteAtivoForm ? parseCurrencyBr(limiteValorForm) : null;
      if (limiteAtivoForm && (!limiteDiario || limiteDiario <= 0)) {
        throw new Error("Informe um limite diário maior que zero.");
      }
      const res = await fetch("/api/asaas/conta-digital", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "salvar-limite-pix",
          limiteAtivo: limiteAtivoForm,
          limiteDiario,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Não foi possível salvar o limite.");
      setMensagem({ texto: "Limite diário de Pix atualizado.", tipo: "sucesso" });
      await carregar({ refresh: true });
    } catch (err) {
      setMensagem({
        texto: err instanceof Error ? err.message : "Falha ao salvar limite.",
        tipo: "erro",
      });
    } finally {
      setSalvandoLimite(false);
    }
  }

  function validarLimiteAntesPix(valor: number) {
    if (!limitePix.ativo || limitePix.limiteDiario == null) return null;
    if (valor > (limitePix.disponivelHoje ?? 0) + 0.001) {
      return `Limite diário de Pix: disponível hoje ${money(limitePix.disponivelHoje ?? 0)} (limite ${money(limitePix.limiteDiario)}).`;
    }
    return null;
  }

  async function validarBoleto() {
    setProcessando(true);
    setMensagem(null);
    try {
      const res = await fetch("/api/asaas/conta-digital", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "validar-boleto", linhaDigitavel }),
      });
      const json = (await res.json()) as { boleto?: typeof boletoValidado; error?: string };
      if (!res.ok) throw new Error(json.error || "Boleto inválido.");
      setBoletoValidado(json.boleto || null);
      setMensagem({ texto: "Boleto validado com sucesso.", tipo: "sucesso" });
    } catch (err) {
      setBoletoValidado(null);
      setMensagem({
        texto: err instanceof Error ? err.message : "Falha na validação.",
        tipo: "erro",
      });
    } finally {
      setProcessando(false);
    }
  }

  async function pagarBoleto() {
    setProcessando(true);
    setMensagem(null);
    try {
      const res = await fetch("/api/asaas/conta-digital", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "pagar-boleto", linhaDigitavel }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Pagamento não realizado.");
      setLinhaDigitavel("");
      setBoletoValidado(null);
      setMensagem({ texto: "Pagamento solicitado com sucesso.", tipo: "sucesso" });
      await carregar({ refresh: true });
    } catch (err) {
      setMensagem({
        texto: err instanceof Error ? err.message : "Falha no pagamento.",
        tipo: "erro",
      });
    } finally {
      setProcessando(false);
    }
  }

  async function transferirPix(senhaProprietario?: string) {
    setProcessando(true);
    setMensagem(null);
    setErroModalPix(null);
    try {
      const valor = parseCurrencyBr(valorPix);
      if (valor <= 0) {
        throw new Error("Informe um valor válido.");
      }
      if (!chavePix.trim()) {
        throw new Error("Informe a chave Pix.");
      }
      const avisoLimite = validarLimiteAntesPix(valor);
      if (avisoLimite) throw new Error(avisoLimite);
      const res = await fetch("/api/asaas/conta-digital", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "transferir-pix",
          valor,
          chavePix,
          tipoChave,
          ...(senhaProprietario ? { senhaProprietario } : {}),
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        transferencia?: { status?: string };
        limitePix?: ResumoLimitePixContaDigital;
      };
      if (!res.ok) throw new Error(json.error || "Transferência não realizada.");
      if (json.limitePix) setLimitePix(json.limitePix);
      setValorPix("");
      setChavePix("");
      setModalPixSubconta(false);
      setMensagem({
        texto: mensagemTransferenciaPix(subconta?.modoIntegracao, json.transferencia?.status),
        tipo: "sucesso",
      });
      await carregar({ refresh: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha na transferência.";
      if (modalPixSubconta) {
        setErroModalPix(msg);
      } else {
        setMensagem({ texto: msg, tipo: "erro" });
      }
    } finally {
      setProcessando(false);
    }
  }

  function solicitarTransferenciaPix() {
    const valor = parseCurrencyBr(valorPix);
    if (valor <= 0) {
      setMensagem({ texto: "Informe um valor válido.", tipo: "erro" });
      return;
    }
    if (!chavePix.trim()) {
      setMensagem({ texto: "Informe a chave Pix.", tipo: "erro" });
      return;
    }
    const avisoLimite = validarLimiteAntesPix(valor);
    if (avisoLimite) {
      setMensagem({ texto: avisoLimite, tipo: "erro" });
      return;
    }
    if (subconta?.modoIntegracao === "subconta") {
      setErroModalPix(null);
      setModalPixSubconta(true);
      return;
    }
    void transferirPix();
  }

  if (carregando) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 text-sm text-slate-500",
          embedded && "py-4"
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando conta digital…
      </div>
    );
  }

  const status = subconta?.status || "nao_iniciado";
  const badge = rotuloStatus(status);
  const contaOperacional =
    Boolean(subconta?.contaAtiva) || subconta?.modoIntegracao === "legado";
  const modoVisualizacao = embedded && abaSolicitada === "extrato";
  const modoOperacoes = !modoVisualizacao;

  if (!contaOperacional) {
    return (
      <div className={embedded ? "" : undefined}>
        <div className="max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            <Wallet className="mt-0.5 h-8 w-8 text-[#4a90d9]" />
            <div>
              <h2 className="text-[15px] font-medium text-slate-800">Conta Digital</h2>
              <p className="mt-1 text-[12px] text-slate-600">
                Conecte sua conta Asaas para consultar saldo, pagar boletos e transferir Pix sem
                sair do Lab Prótese.
              </p>
              <p className="mt-2 text-[11px] text-slate-500">
                Se o CNPJ do laboratório for o mesmo da conta-mãe da plataforma, use a{" "}
                <strong>chave API manual (legado)</strong> em Configurações → Boletos.
              </p>
              <span
                className={cn(
                  "mt-3 inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                  badge.cor
                )}
              >
                {badge.texto}
              </span>
            </div>
          </div>
          <Link
            href={linkConfiguracoes(pathname)}
            className="mt-5 inline-flex h-9 items-center rounded bg-[#4a90d9] px-4 text-[13px] text-white hover:bg-[#3d7fc4]"
          >
            Configurar conta Asaas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? "space-y-4" : undefined}>
      {embedded ? (
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <Wallet className="h-5 w-5 text-[#4a90d9]" />
          <div>
            <h3 className="text-[14px] font-semibold text-slate-800">Conta Bancária Asaas</h3>
            <p className="text-[11px] text-slate-500">
              {modoVisualizacao
                ? "Saldo e movimentações da conta"
                : "Saldo, extrato, pagamento de boletos e transferências Pix"}
            </p>
          </div>
        </div>
      ) : null}
      {mensagem ? (
        <p
          className={cn(
            "mb-4 rounded border px-3 py-2 text-[12px]",
            mensagem.tipo === "sucesso"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          )}
        >
          {mensagem.texto}
        </p>
      ) : null}

      <div
        className={cn(
          "mb-4 grid gap-3",
          modoVisualizacao ? "max-w-md grid-cols-1" : "md:grid-cols-3"
        )}
      >
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] text-slate-500">Saldo disponível</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{money(saldo)}</p>
          {subconta?.conta ? (
            <p className="mt-2 text-[11px] text-slate-500">
              Ag. {subconta.agencia || "—"} · Cc {subconta.conta}
              {subconta.contaDigito ? `-${subconta.contaDigito}` : ""}
            </p>
          ) : null}
        </div>
        {modoOperacoes ? (
          <>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-600">
            <Shield className="h-4 w-4 text-[#4a90d9]" />
            <p className="text-[11px] font-medium">Limite Pix (hoje)</p>
          </div>
          {limitePix.ativo && limitePix.limiteDiario != null ? (
            <>
              <p className="mt-2 text-[13px] text-slate-800">
                Usado: <strong>{money(limitePix.usadoHoje)}</strong>
              </p>
              <p className="mt-1 text-[13px] text-emerald-700">
                Disponível: <strong>{money(limitePix.disponivelHoje ?? 0)}</strong>
              </p>
              <p className="mt-1 text-[10px] text-slate-400">
                Teto diário: {money(limitePix.limiteDiario)}
              </p>
            </>
          ) : (
            <p className="mt-2 text-[12px] text-slate-500">Sem limite diário ativo.</p>
          )}
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="flex items-center gap-2 text-emerald-800">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-[13px] font-medium">
              {subconta?.modoIntegracao === "legado"
                ? "Conta Asaas conectada (modo legado)"
                : "Conta digital ativa"}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-emerald-900/80">
            {subconta?.modoIntegracao === "legado"
              ? "Saldo, pagamentos de boleto e transferências Pix usam a chave API configurada em Configurações → Boletos."
              : "Emissão de boletos nas receitas usa automaticamente esta conta. Pagamentos e transferências abaixo debitam deste saldo."}
          </p>
        </div>
          </>
        ) : null}
      </div>

      {modoOperacoes ? (
      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
        {(
          [
            ["extrato", "Extrato", FileText],
            ["pagar", "Pagar boleto", FileText],
            ["transferir", "Transferir Pix", ArrowLeftRight],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setAba(id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[12px] font-medium transition",
              aba === id
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>
      ) : null}

      {aba === "extrato" || modoVisualizacao ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-[12px]">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] text-slate-500">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Descrição</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {movimentacoes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                    Nenhuma movimentação recente.
                  </td>
                </tr>
              ) : (
                movimentacoes.map((mov) => (
                  <tr key={mov.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 whitespace-nowrap">{mov.date}</td>
                    <td className="px-3 py-2">{mov.description || "—"}</td>
                    <td className="px-3 py-2 text-slate-500">{mov.type}</td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right font-medium",
                        mov.value >= 0 ? "text-emerald-700" : "text-red-700"
                      )}
                    >
                      {money(mov.value)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {aba === "pagar" && modoOperacoes ? (
        <div className="max-w-xl space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <label className={labelClass}>Linha digitável do boleto</label>
            <input
              type="text"
              value={linhaDigitavel}
              onChange={(e) => {
                setLinhaDigitavel(e.target.value);
                setBoletoValidado(null);
              }}
              className={cn(inputClass, "font-mono text-[11px]")}
              placeholder="Cole ou digite a linha digitável"
            />
          </div>
          {boletoValidado ? (
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-[12px]">
              <p>
                <strong>Valor:</strong> {money(boletoValidado.valor)}
              </p>
              {boletoValidado.beneficiario ? (
                <p>
                  <strong>Beneficiário:</strong> {boletoValidado.beneficiario}
                </p>
              ) : null}
              {boletoValidado.vencimento ? (
                <p>
                  <strong>Vencimento:</strong>{" "}
                  {new Date(boletoValidado.vencimento + "T12:00:00").toLocaleDateString("pt-BR")}
                </p>
              ) : null}
              {boletoValidado.taxa != null && boletoValidado.taxa > 0 ? (
                <p>
                  <strong>Taxa Asaas:</strong> {money(boletoValidado.taxa)}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={processando} onClick={() => void validarBoleto()}>
              Validar boleto
            </Button>
            <Button type="button" disabled={processando || !boletoValidado} onClick={() => void pagarBoleto()}>
              Pagar boleto
            </Button>
          </div>
        </div>
      ) : null}

      {aba === "transferir" && modoOperacoes ? (
        <div className="max-w-xl space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-2 text-slate-700">
              <Shield className="h-4 w-4 text-[#4a90d9]" />
              <p className="text-[12px] font-medium">Limite diário de Pix</p>
            </div>
            {podeConfigurarLimite ? (
              <div className="mt-3 space-y-3">
                <label className="flex items-center gap-2 text-[12px] text-slate-700">
                  <input
                    type="checkbox"
                    checked={limiteAtivoForm}
                    onChange={(e) => setLimiteAtivoForm(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Ativar limite diário de transferências Pix
                </label>
                <div>
                  <label className={labelClass}>Valor máximo por dia</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={limiteValorForm}
                    onChange={(e) => setLimiteValorForm(formatCurrencyInput(e.target.value))}
                    disabled={!limiteAtivoForm}
                    className={cn(inputClass, !limiteAtivoForm && "bg-slate-100 text-slate-400")}
                    placeholder="R$ 0,00"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={salvandoLimite}
                  onClick={() => void salvarLimitePix()}
                >
                  {salvandoLimite ? "Salvando…" : "Salvar limite"}
                </Button>
                <p className="text-[10px] text-slate-500">
                  Somente o proprietário pode alterar. O contador zera à meia-noite (horário do
                  servidor).
                </p>
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-slate-500">
                {limitePix.ativo && limitePix.limiteDiario != null
                  ? `Limite ativo: ${money(limitePix.limiteDiario)} por dia. Disponível hoje: ${money(limitePix.disponivelHoje ?? 0)}.`
                  : "Nenhum limite diário configurado pelo proprietário."}
              </p>
            )}
          </div>

          {subconta?.modoIntegracao === "legado" ? (
            <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
              No <strong>modo legado</strong>, saques e Pix exigem{" "}
              <strong>aprovação manual</strong> no site ou app do Asaas (token SMS/app ou
              autorização crítica). Isso é uma proteção da própria conta Asaas, não do Lab
              Prótese.
            </p>
          ) : (
            <p className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-900">
              Na <strong>subconta BaaS</strong>, o Pix exige{" "}
              <strong>senha do proprietário</strong> no Lab Prótese. O Asaas só conclui se a
              transferência tiver sido autorizada aqui (webhook de segurança da conta-mãe).
            </p>
          )}
          <div>
            <label className={labelClass}>Valor</label>
            <input
              type="text"
              inputMode="numeric"
              value={valorPix}
              onChange={(e) => setValorPix(formatCurrencyInput(e.target.value))}
              className={inputClass}
              placeholder="R$ 0,00"
            />
          </div>
          <div>
            <label className={labelClass}>Tipo da chave</label>
            <select
              value={tipoChave}
              onChange={(e) =>
                setTipoChave(e.target.value as typeof tipoChave)
              }
              className={inputClass}
            >
              <option value="EVP">Aleatória</option>
              <option value="CPF">CPF</option>
              <option value="CNPJ">CNPJ</option>
              <option value="EMAIL">E-mail</option>
              <option value="PHONE">Telefone</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Chave Pix</label>
            <input
              type="text"
              value={chavePix}
              onChange={(e) => setChavePix(e.target.value)}
              className={inputClass}
            />
          </div>
          <Button type="button" disabled={processando} onClick={solicitarTransferenciaPix}>
            Transferir Pix
          </Button>
        </div>
      ) : null}

      <ConfirmarPixSubcontaModal
        open={modalPixSubconta}
        valor={valorPix}
        chavePix={chavePix}
        tipoChave={tipoChave}
        processando={processando}
        erro={erroModalPix}
        onClose={() => {
          if (!processando) setModalPixSubconta(false);
        }}
        onConfirmar={async (senha) => {
          await transferirPix(senha);
        }}
      />

      {modoOperacoes ? (
      <AsaasSeloInstitucional
        detalhado
        className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-5"
      />
      ) : null}
    </div>
  );
}
