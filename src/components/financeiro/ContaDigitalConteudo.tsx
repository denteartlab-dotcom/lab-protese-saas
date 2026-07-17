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
import { useI18n } from "@/components/i18n-provider";
import { AsaasSeloInstitucional } from "@/components/AsaasSeloInstitucional";
import { ConfirmarPixSubcontaModal } from "@/components/financeiro/ConfirmarPixSubcontaModal";
import { analisarCaminhoApp, montarCaminhoAppComSlug } from "@/lib/rotas-app";
import { fetchPainelFinanceiro } from "@/lib/financeiro-painel-cliente";
import type { PainelFinanceiroContaDigital } from "@/lib/financeiro-painel-types";
import type { ResumoLimitePixContaDigital } from "@/lib/conta-digital-pix-limite";
import { parseCurrencyBr } from "@/lib/cliente-financeiro";
import { cn } from "@/lib/utils";
import {
  formatMoedaContaBancaria,
  labelTipoMovimentacaoAsaas,
} from "@/lib/i18n/conta-bancaria-i18n";
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
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const money = useCallback(
    (value: number) => formatMoedaContaBancaria(value, locale),
    [locale]
  );

  const formatCurrencyInput = useCallback(
    (value: string) => money(Number(value.replace(/\D/g, "")) / 100),
    [money]
  );

  const mensagemTransferenciaPix = useCallback(
    (modo: SubcontaResumo["modoIntegracao"], status?: string | null) => {
      const pendente = !status || status === "PENDING" || status === "BANK_PROCESSING";
      if (modo === "legado" && pendente) {
        return t("financeiro.conta.digital.transferenciaLegadoPendente");
      }
      if (modo === "subconta" && pendente) {
        return t("financeiro.conta.digital.transferenciaSubcontaPendente");
      }
      if (status === "DONE") return t("financeiro.conta.digital.transferenciaConcluida");
      return t("financeiro.conta.digital.transferenciaSolicitada");
    },
    [t]
  );

  const rotuloStatus = useCallback(
    (status: StatusSubconta) => {
      switch (status) {
        case "aprovada":
          return {
            texto: t("financeiro.conta.digital.status.aprovada"),
            cor: "text-emerald-700 bg-emerald-50 border-emerald-200",
          };
        case "em_analise":
          return {
            texto: t("financeiro.conta.digital.status.emAnalise"),
            cor: "text-amber-700 bg-amber-50 border-amber-200",
          };
        case "reprovada":
          return {
            texto: t("financeiro.conta.digital.status.reprovada"),
            cor: "text-red-700 bg-red-50 border-red-200",
          };
        case "pendente_documentos":
          return {
            texto: t("financeiro.conta.digital.status.pendenteDocumentos"),
            cor: "text-blue-700 bg-blue-50 border-blue-200",
          };
        default:
          return {
            texto: t("financeiro.conta.digital.status.naoIniciada"),
            cor: "text-slate-600 bg-slate-50 border-slate-200",
          };
      }
    },
    [t]
  );

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
    const isRefresh = Boolean(opts?.refresh);
    if (!isRefresh) setCarregando(true);
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
      // Em refresh (ex.: após Pix), não zera a conta — só mostra o erro.
      if (!isRefresh) {
        setMensagem({
          texto: err instanceof Error ? err.message : t("financeiro.conta.digital.erroCarregar"),
          tipo: "erro",
        });
      } else {
        setMensagem({
          texto:
            err instanceof Error
              ? err.message
              : t("financeiro.conta.digital.erroCarregar"),
          tipo: "erro",
        });
      }
    } finally {
      if (!isRefresh) setCarregando(false);
    }
  }, [money, t]);

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
        throw new Error(t("financeiro.conta.digital.erroLimiteMaiorZero"));
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
      if (!res.ok) throw new Error(json.error || t("financeiro.conta.digital.erroSalvarLimite"));
      setMensagem({ texto: t("financeiro.conta.digital.sucessoLimite"), tipo: "sucesso" });
      await carregar({ refresh: true });
    } catch (err) {
      setMensagem({
        texto: err instanceof Error ? err.message : t("financeiro.conta.digital.erroFalhaLimite"),
        tipo: "erro",
      });
    } finally {
      setSalvandoLimite(false);
    }
  }

  function validarLimiteAntesPix(valor: number) {
    if (!limitePix.ativo || limitePix.limiteDiario == null) return null;
    if (valor > (limitePix.disponivelHoje ?? 0) + 0.001) {
      return t("financeiro.conta.digital.limitePixDisponivel", {
        disponivel: money(limitePix.disponivelHoje ?? 0),
        limite: money(limitePix.limiteDiario),
      });
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
      if (!res.ok) throw new Error(json.error || t("financeiro.conta.digital.erroBoletoInvalido"));
      setBoletoValidado(json.boleto || null);
      setMensagem({ texto: t("financeiro.conta.digital.sucessoBoletoValidado"), tipo: "sucesso" });
    } catch (err) {
      setBoletoValidado(null);
      setMensagem({
        texto: err instanceof Error ? err.message : t("financeiro.conta.digital.erroValidacaoBoleto"),
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
      if (!res.ok) throw new Error(json.error || t("financeiro.conta.digital.erroPagamentoNaoRealizado"));
      setLinhaDigitavel("");
      setBoletoValidado(null);
      setMensagem({ texto: t("financeiro.conta.digital.sucessoPagamento"), tipo: "sucesso" });
      await carregar({ refresh: true });
    } catch (err) {
      setMensagem({
        texto: err instanceof Error ? err.message : t("financeiro.conta.digital.erroPagamento"),
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
        throw new Error(t("financeiro.conta.digital.erroValorInvalido"));
      }
      if (!chavePix.trim()) {
        throw new Error(t("financeiro.conta.digital.erroChavePix"));
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
      if (!res.ok) throw new Error(json.error || t("financeiro.conta.digital.erroTransferencia"));
      if (json.limitePix) setLimitePix(json.limitePix);
      setValorPix("");
      setChavePix("");
      setModalPixSubconta(false);
      setMensagem({
        texto: mensagemTransferenciaPix(subconta?.modoIntegracao, json.transferencia?.status),
        tipo: "sucesso",
      });
      setAba("transferir");
      await carregar({ refresh: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("financeiro.conta.digital.erroFalhaTransferencia");
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
      setMensagem({ texto: t("financeiro.conta.digital.erroValorInvalido"), tipo: "erro" });
      return;
    }
    if (!chavePix.trim()) {
      setMensagem({ texto: t("financeiro.conta.digital.erroChavePix"), tipo: "erro" });
      return;
    }
    const avisoLimite = validarLimiteAntesPix(valor);
    if (avisoLimite) {
      setMensagem({ texto: avisoLimite, tipo: "erro" });
      return;
    }
    setErroModalPix(null);
    setModalPixSubconta(true);
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
        {t("financeiro.conta.digital.carregando")}
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
              <h2 className="text-[15px] font-medium text-slate-800">
                {t("financeiro.conta.digital.titulo")}
              </h2>
              <p className="mt-1 text-[12px] text-slate-600">
                {t("financeiro.conta.digital.descricaoNaoIniciada")}
              </p>
              <p className="mt-2 text-[11px] text-slate-500">
                {t("financeiro.conta.digital.dicaLegado")}
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
            {t("financeiro.conta.digital.configurarAsaas")}
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
            <h3 className="text-[14px] font-semibold text-slate-800">
              {t("financeiro.conta.digital.tituloEmbutido")}
            </h3>
            <p className="text-[11px] text-slate-500">
              {modoVisualizacao
                ? t("financeiro.conta.digital.subtituloVisualizacao")
                : t("financeiro.conta.digital.subtituloCompleto")}
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
          <p className="text-[11px] text-slate-500">{t("financeiro.conta.digital.saldoDisponivel")}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{money(saldo)}</p>
          {subconta?.conta ? (
            <p className="mt-2 text-[11px] text-slate-500">
              {t("financeiro.conta.digital.agenciaConta", {
                agencia: subconta.agencia || "—",
                conta: subconta.conta,
                digito: subconta.contaDigito ? `-${subconta.contaDigito}` : "",
              })}
            </p>
          ) : null}
        </div>
        {modoOperacoes ? (
          <>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-600">
            <Shield className="h-4 w-4 text-[#4a90d9]" />
            <p className="text-[11px] font-medium">{t("financeiro.conta.digital.limitePixHoje")}</p>
          </div>
          {limitePix.ativo && limitePix.limiteDiario != null ? (
            <>
              <p className="mt-2 text-[13px] text-slate-800">
                {t("financeiro.conta.digital.usado")}{" "}
                <strong>{money(limitePix.usadoHoje)}</strong>
              </p>
              <p className="mt-1 text-[13px] text-emerald-700">
                {t("financeiro.conta.digital.disponivel")}{" "}
                <strong>{money(limitePix.disponivelHoje ?? 0)}</strong>
              </p>
              <p className="mt-1 text-[10px] text-slate-400">
                {t("financeiro.conta.digital.tetoDiario", {
                  valor: money(limitePix.limiteDiario),
                })}
              </p>
            </>
          ) : (
            <p className="mt-2 text-[12px] text-slate-500">
              {t("financeiro.conta.digital.semLimiteAtivo")}
            </p>
          )}
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="flex items-center gap-2 text-emerald-800">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-[13px] font-medium">
              {subconta?.modoIntegracao === "legado"
                ? t("financeiro.conta.digital.contaLegado")
                : t("financeiro.conta.digital.contaAtiva")}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-emerald-900/80">
            {subconta?.modoIntegracao === "legado"
              ? t("financeiro.conta.digital.infoLegado")
              : t("financeiro.conta.digital.infoSubconta")}
          </p>
        </div>
          </>
        ) : null}
      </div>

      {modoOperacoes ? (
      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
        {(
          [
            ["extrato", t("financeiro.conta.digital.aba.extrato"), FileText],
            ["pagar", t("financeiro.conta.digital.aba.pagar"), FileText],
            ["transferir", t("financeiro.conta.digital.aba.transferir"), ArrowLeftRight],
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
                <th className="px-3 py-2">{t("financeiro.conta.digital.col.data")}</th>
                <th className="px-3 py-2">{t("financeiro.conta.digital.col.descricao")}</th>
                <th className="px-3 py-2">{t("financeiro.conta.digital.col.tipo")}</th>
                <th className="px-3 py-2 text-right">{t("financeiro.conta.digital.col.valor")}</th>
              </tr>
            </thead>
            <tbody>
              {movimentacoes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                    {t("financeiro.conta.digital.vazioMovimentacoes")}
                  </td>
                </tr>
              ) : (
                movimentacoes.map((mov) => (
                  <tr key={mov.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 whitespace-nowrap">{mov.date}</td>
                    <td className="px-3 py-2">{mov.description || "—"}</td>
                    <td className="px-3 py-2 text-slate-500">
                      {labelTipoMovimentacaoAsaas(mov.type, t)}
                    </td>
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
            <label className={labelClass}>{t("financeiro.conta.digital.labelLinhaDigitavel")}</label>
            <input
              type="text"
              value={linhaDigitavel}
              onChange={(e) => {
                setLinhaDigitavel(e.target.value);
                setBoletoValidado(null);
              }}
              className={cn(inputClass, "font-mono text-[11px]")}
              placeholder={t("financeiro.conta.digital.placeholderLinhaDigitavel")}
            />
          </div>
          {boletoValidado ? (
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-[12px]">
              <p>
                <strong>{t("financeiro.conta.digital.labelValor")}</strong> {money(boletoValidado.valor)}
              </p>
              {boletoValidado.beneficiario ? (
                <p>
                  <strong>{t("financeiro.conta.digital.labelBeneficiario")}</strong>{" "}
                  {boletoValidado.beneficiario}
                </p>
              ) : null}
              {boletoValidado.vencimento ? (
                <p>
                  <strong>{t("financeiro.conta.digital.labelVencimento")}</strong>{" "}
                  {new Date(boletoValidado.vencimento + "T12:00:00").toLocaleDateString(
                    locale === "pt" ? "pt-BR" : locale === "es" ? "es" : "en-US"
                  )}
                </p>
              ) : null}
              {boletoValidado.taxa != null && boletoValidado.taxa > 0 ? (
                <p>
                  <strong>{t("financeiro.conta.digital.labelTaxaAsaas")}</strong>{" "}
                  {money(boletoValidado.taxa)}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={processando} onClick={() => void validarBoleto()}>
              {t("financeiro.conta.digital.validarBoleto")}
            </Button>
            <Button type="button" disabled={processando || !boletoValidado} onClick={() => void pagarBoleto()}>
              {t("financeiro.conta.digital.pagarBoleto")}
            </Button>
          </div>
        </div>
      ) : null}

      {aba === "transferir" && modoOperacoes ? (
        <div className="max-w-xl space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-2 text-slate-700">
              <Shield className="h-4 w-4 text-[#4a90d9]" />
              <p className="text-[12px] font-medium">{t("financeiro.conta.digital.limiteDiarioPix")}</p>
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
                  {t("financeiro.conta.digital.ativarLimitePix")}
                </label>
                <div>
                  <label className={labelClass}>{t("financeiro.conta.digital.valorMaximoDia")}</label>
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
                  {salvandoLimite ? t("financeiro.conta.digital.salvando") : t("financeiro.conta.digital.salvarLimite")}
                </Button>
                <p className="text-[10px] text-slate-500">
                  {t("financeiro.conta.digital.dicaLimiteProprietario")}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-slate-500">
                {limitePix.ativo && limitePix.limiteDiario != null
                  ? t("financeiro.conta.digital.limiteAtivoResumo", {
                      limite: money(limitePix.limiteDiario),
                      disponivel: money(limitePix.disponivelHoje ?? 0),
                    })
                  : t("financeiro.conta.digital.semLimiteConfigurado")}
              </p>
            )}
          </div>

          {subconta?.modoIntegracao === "legado" ? (
            <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
              {t("financeiro.conta.digital.avisoLegadoPix")}
            </p>
          ) : (
            <p className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-900">
              {t("financeiro.conta.digital.avisoSubcontaPix")}
            </p>
          )}
          <div>
            <label className={labelClass}>{t("financeiro.conta.digital.labelValorPix")}</label>
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
            <label className={labelClass}>{t("financeiro.conta.digital.labelTipoChave")}</label>
            <select
              value={tipoChave}
              onChange={(e) =>
                setTipoChave(e.target.value as typeof tipoChave)
              }
              className={inputClass}
            >
              <option value="EVP">{t("financeiro.conta.digital.chaveAleatoria")}</option>
              <option value="CPF">{t("financeiro.conta.digital.chaveCpf")}</option>
              <option value="CNPJ">{t("financeiro.conta.digital.chaveCnpj")}</option>
              <option value="EMAIL">{t("financeiro.conta.digital.chaveEmail")}</option>
              <option value="PHONE">{t("financeiro.conta.digital.chaveTelefone")}</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>{t("financeiro.conta.digital.labelChavePix")}</label>
            <input
              type="text"
              value={chavePix}
              onChange={(e) => setChavePix(e.target.value)}
              className={inputClass}
            />
          </div>
          <Button type="button" disabled={processando} onClick={solicitarTransferenciaPix}>
            {t("financeiro.conta.digital.transferirPix")}
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
