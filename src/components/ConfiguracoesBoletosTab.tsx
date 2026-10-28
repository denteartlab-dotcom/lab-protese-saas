"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Wallet,
  XCircle,
} from "lucide-react";
import { ConfirmacaoExclusaoModal } from "@/components/ConfirmacaoExclusaoModal";
import { TaxaAberturaSubcontaModal } from "@/components/configuracoes/TaxaAberturaSubcontaModal";
import { Button } from "@/components/ui";
import { AsaasSeloInstitucional } from "@/components/AsaasSeloInstitucional";
import type { TipoMensagemForm } from "@/components/DadosLaboratorioForm";
import { onboardingUrlAindaValida } from "@/lib/taxa-abertura-subconta-const";
import { cn } from "@/lib/utils";

const labelClass = "mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400";
const inputClass =
  "h-9 w-full rounded border border-slate-300 bg-white px-2.5 text-[12px] text-slate-800 outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9] dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-primary-500 dark:focus:ring-primary-500";


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
  onboardingUrlExpirationDate?: string | null;
};

type TaxaAbertura = {
  paga: boolean;
  cadastroAberto: boolean;
  onboardingUrl: string | null;
  onboardingUrlExpiraEm: string | null;
  cobranca: {
    cobrancaId: string;
    pixPayload: string | null;
    pixEncodedImage: string | null;
    pago: boolean;
  } | null;
};

type SubcontaResumo = {
  status: StatusSubconta;
  contaAtiva?: boolean;
  contaMaeConfigurada?: boolean;
  podeUsarIntegracaoManual?: boolean;
  /** Há subconta real no Asaas (asaasAccountId + apiKey). */
  subcontaCriada?: boolean;
  subcontaIniciada?: boolean;
  asaasAccountId?: string | null;
  /** Exibe o botão Cancelar (independe do saldo). */
  podeExibirCancelarContaDigital?: boolean;
  /** Cancelamento liberado (saldo zerado). */
  podeCancelarContaDigital?: boolean;
  podeAbrirContaDigital?: boolean;
  /** Subconta existe, mas nenhum documento foi enviado. A tela mostra Abrir conta de novo. */
  envioDocumentosPendente?: boolean;
  saldo?: number | null;
  agencia?: string | null;
  conta?: string | null;
  contaDigito?: string | null;
  statusGeral?: string | null;
};

function rotuloStatus(status: StatusSubconta) {
  switch (status) {
    case "aprovada":
      return { texto: "Aprovada", Icon: CheckCircle2, cor: "text-emerald-700" };
    case "em_analise":
      return { texto: "Em análise", Icon: Clock, cor: "text-amber-700" };
    case "reprovada":
      return { texto: "Reprovada", Icon: XCircle, cor: "text-red-700" };
    case "pendente_documentos":
      return { texto: "Aguardando documentos", Icon: ShieldCheck, cor: "text-blue-700" };
    default:
      return { texto: "Não iniciada", Icon: Wallet, cor: "text-slate-600" };
  }
}

/** Status do documento Asaas → rótulo PT e cor (vermelho / verde). */
function rotuloStatusDocumento(status?: string | null) {
  const chave = String(status || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (!chave) return null;
  if (chave === "NOT_SENT" || chave === "NAO_ENVIADO" || chave === "NÃO_ENVIADO") {
    return { texto: "Não enviado", cor: "text-red-600" };
  }
  if (
    chave === "PENDING" ||
    chave === "SENT" ||
    chave === "APPROVED" ||
    chave === "ENVIADO" ||
    chave === "AWAITING_APPROVAL"
  ) {
    return { texto: "Enviado", cor: "text-emerald-600" };
  }
  if (chave === "REJECTED" || chave === "REPROVED") {
    return { texto: "Reprovado", cor: "text-red-600" };
  }
  return { texto: status!.trim(), cor: "text-slate-600" };
}

const ASAAS_ONBOARDING_SESSAO_KEY = "labProteseAsaasOnboardingAtivo";

function marcarOnboardingAsaasAtivo() {
  try {
    sessionStorage.setItem(ASAAS_ONBOARDING_SESSAO_KEY, "1");
  } catch {
    /* ignore */
  }
}

function limparOnboardingAsaasAtivo() {
  try {
    sessionStorage.removeItem(ASAAS_ONBOARDING_SESSAO_KEY);
  } catch {
    /* ignore */
  }
}

function onboardingAsaasAtivoNaSessao() {
  try {
    return sessionStorage.getItem(ASAAS_ONBOARDING_SESSAO_KEY) === "1";
  } catch {
    return false;
  }
}

function urlEnvioDocumentos(docs: DocumentoOnboarding[]) {
  return docs.find((doc) => doc.onboardingUrl)?.onboardingUrl || null;
}

/** Abre a aba no clique (antes do await) para o bloqueador de pop-up não impedir o envio. */
function prepararAbaEnvioDocumentos() {
  try {
    return window.open("about:blank", "_blank");
  } catch {
    return null;
  }
}

function irParaUrl(aba: Window | null, url: string) {
  if (aba && !aba.closed) {
    aba.location.href = url;
    return true;
  }
  const nova = window.open(url, "_blank", "noopener,noreferrer");
  return Boolean(nova);
}

function irParaEnvioDocumentos(aba: Window | null, docs: DocumentoOnboarding[]) {
  const url = urlEnvioDocumentos(docs);
  if (!url) {
    if (aba && !aba.closed) aba.close();
    return false;
  }
  return irParaUrl(aba, url);
}

function escreverAbaAguardando(aba: Window | null) {
  if (!aba || aba.closed) return;
  try {
    aba.document.open();
    aba.document.write(
      "<!doctype html><title>Aguardando pagamento</title><p style=\"font-family:sans-serif;padding:24px\">Aguardando a confirmação do PIX de R$ 15,00. Esta aba abrirá o cadastro da subconta quando o pagamento for confirmado.</p>"
    );
    aba.document.close();
  } catch {
    /* a aba segue em branco até o pagamento */
  }
}

export function ConfiguracoesBoletosTab() {
  const [subconta, setSubconta] = useState<SubcontaResumo | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoOnboarding[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [abrindo, setAbrindo] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [documentosReabertos, setDocumentosReabertos] = useState(false);

  const [modoLegado, setModoLegado] = useState(false);
  const [ambiente, setAmbiente] = useState<"sandbox" | "producao">("sandbox");
  const [apiKey, setApiKey] = useState("");
  const [webhookToken, setWebhookToken] = useState("");
  const [apiKeyConfigurada, setApiKeyConfigurada] = useState(false);
  const [podeUsarIntegracaoManual, setPodeUsarIntegracaoManual] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [salvandoLegado, setSalvandoLegado] = useState(false);
  const [feedbackLocal, setFeedbackLocal] = useState<{
    texto: string;
    tipo: TipoMensagemForm;
  } | null>(null);
  const [taxaAbertura, setTaxaAbertura] = useState<TaxaAbertura | null>(null);
  const [modalTaxaAberto, setModalTaxaAberto] = useState(false);
  const [etapaTaxa, setEtapaTaxa] = useState<"aviso" | "pix" | "confirmado">("aviso");
  const [erroTaxa, setErroTaxa] = useState("");
  const [gerandoTaxa, setGerandoTaxa] = useState(false);
  const [abrindoCadastro, setAbrindoCadastro] = useState(false);
  const abaTaxaRef = useRef<Window | null>(null);
  const abrindoCadastroRef = useRef(false);

  function exibirFeedback(texto: string, tipo: TipoMensagemForm = "info") {
    setFeedbackLocal({ texto, tipo });
    if (tipo === "sucesso" || tipo === "info") {
      window.setTimeout(() => setFeedbackLocal(null), 8000);
    }
  }

  const carregar = useCallback(async (opts?: { silencioso?: boolean }) => {
    if (!opts?.silencioso) setCarregando(true);
    try {
      const manterOnboarding = onboardingAsaasAtivoNaSessao();
      const qs = manterOnboarding ? "?manterOnboarding=1" : "";
      const [resSub, resCfg] = await Promise.all([
        fetch(`/api/asaas/subconta${qs}`, { cache: "no-store" }),
        fetch("/api/asaas/config", { cache: "no-store" }),
      ]);
      const jsonSub = (await resSub.json()) as {
        subconta?: SubcontaResumo;
        documentos?: DocumentoOnboarding[];
        aberturaResetada?: boolean;
        taxaAbertura?: TaxaAbertura;
      };
      const jsonCfg = (await resCfg.json()) as {
        config?: { ambiente?: "sandbox" | "producao"; apiKeyConfigurada?: boolean };
        webhookUrl?: string;
        podeUsarIntegracaoManual?: boolean;
      };

      if (jsonSub.aberturaResetada) {
        limparOnboardingAsaasAtivo();
      }

      const docs = jsonSub.documentos || [];
      setSubconta(jsonSub.subconta || null);
      setDocumentos(docs);
      if (jsonSub.taxaAbertura) setTaxaAbertura(jsonSub.taxaAbertura);
      if (jsonCfg.config?.ambiente) setAmbiente(jsonCfg.config.ambiente);
      setApiKeyConfigurada(Boolean(jsonCfg.config?.apiKeyConfigurada));
      setPodeUsarIntegracaoManual(
        Boolean(
          jsonCfg.podeUsarIntegracaoManual ?? jsonSub.subconta?.podeUsarIntegracaoManual
        )
      );
      setWebhookUrl(jsonCfg.webhookUrl || "");
      return docs;
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    const cancelarLimpezaPendente = () => {
      const timer = (window as Window & { __asaasOnboardingClearTimer?: number })
        .__asaasOnboardingClearTimer;
      if (timer) {
        window.clearTimeout(timer);
        (window as Window & { __asaasOnboardingClearTimer?: number }).__asaasOnboardingClearTimer =
          undefined;
      }
    };

    const agendarLimpezaOnboarding = () => {
      cancelarLimpezaPendente();
      // Atraso evita limpar no remount do React Strict Mode; ao trocar de página limpa de fato.
      (window as Window & { __asaasOnboardingClearTimer?: number }).__asaasOnboardingClearTimer =
        window.setTimeout(() => {
          limparOnboardingAsaasAtivo();
          (window as Window & { __asaasOnboardingClearTimer?: number }).__asaasOnboardingClearTimer =
            undefined;
        }, 500);
    };

    cancelarLimpezaPendente();
    void carregar();
    window.addEventListener("pagehide", agendarLimpezaOnboarding);
    return () => {
      window.removeEventListener("pagehide", agendarLimpezaOnboarding);
      agendarLimpezaOnboarding();
    };
  }, [carregar]);

  async function consultarTaxaAtual() {
    const res = await fetch("/api/asaas/subconta/taxa", { cache: "no-store" });
    const json = (await res.json()) as { error?: string; taxa?: TaxaAbertura };
    if (!res.ok) throw new Error(json.error || "Não foi possível consultar a taxa.");
    if (json.taxa) setTaxaAbertura(json.taxa);
    return json.taxa || null;
  }

  function linkSalvoValido(taxa: TaxaAbertura | null) {
    if (!taxa?.onboardingUrl) return null;
    if (!onboardingUrlAindaValida(taxa.onboardingUrlExpiraEm)) return null;
    return taxa.onboardingUrl;
  }

  async function abrirEnvioDireto(aba: Window | null) {
    const salva = linkSalvoValido(taxaAbertura);
    if (salva && irParaUrl(aba, salva)) {
      marcarOnboardingAsaasAtivo();
      setDocumentosReabertos(true);
      exibirFeedback(
        "A página de envio dos documentos foi aberta. Conclua o envio no Asaas.",
        "sucesso"
      );
      return;
    }

    marcarOnboardingAsaasAtivo();
    setDocumentosReabertos(true);
    let docs = documentos;
    if (!urlEnvioDocumentos(docs)) {
      docs = (await carregar({ silencioso: true })) || docs;
    }
    setDocumentosReabertos(true);
    if (irParaEnvioDocumentos(aba, docs)) {
      const url = urlEnvioDocumentos(docs);
      const doc = docs.find((item) => item.onboardingUrl);
      if (url) {
        void fetch("/api/asaas/subconta/taxa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            marcarCadastroAberto: true,
            onboardingUrl: url,
            onboardingUrlExpiraEm: doc?.onboardingUrlExpirationDate || null,
          }),
        }).catch(() => undefined);
      }
      exibirFeedback(
        "A página de envio dos documentos foi aberta. Conclua o envio no Asaas.",
        "sucesso"
      );
      return;
    }
    if (aba && !aba.closed) aba.close();
    exibirFeedback(
      "Conta reaberta. Se o link ainda não aparecer, clique em Atualizar status em alguns segundos e depois em Enviar documentos.",
      "info"
    );
  }

  async function criarContaEAbrir(aba: Window | null) {
    if (abrindoCadastroRef.current) return;
    abrindoCadastroRef.current = true;
    setAbrindoCadastro(true);
    setAbrindo(true);
    setErroTaxa("");
    let abriu = false;
    try {
      const res = await fetch("/api/asaas/subconta", { method: "POST" });
      const texto = await res.text();
      let json: { error?: string; documentos?: DocumentoOnboarding[] } = {};
      try {
        json = texto
          ? (JSON.parse(texto) as { error?: string; documentos?: DocumentoOnboarding[] })
          : {};
      } catch {
        throw new Error(texto.slice(0, 200) || "Resposta inválida do servidor.");
      }
      if (!res.ok) throw new Error(json.error || "Não foi possível abrir a conta.");
      marcarOnboardingAsaasAtivo();
      setDocumentosReabertos(true);
      const docsResposta = json.documentos || [];
      if (docsResposta.length > 0) setDocumentos(docsResposta);
      abriu = irParaEnvioDocumentos(aba, docsResposta);
      const recarregados = (await carregar({ silencioso: true })) || [];
      if (recarregados.length === 0 && docsResposta.length > 0) {
        setDocumentos(docsResposta);
      }
      if (!abriu) {
        abriu = irParaEnvioDocumentos(null, recarregados.length ? recarregados : docsResposta);
      }
      if (!abriu) {
        setEtapaTaxa("confirmado");
        setModalTaxaAberto(true);
        setErroTaxa("O pagamento foi confirmado. Clique em abrir o cadastro da subconta.");
        return;
      }
      setModalTaxaAberto(false);
      setEtapaTaxa("aviso");
      exibirFeedback(
        "A página de cadastro da subconta foi aberta. Conclua o envio dos documentos no Asaas.",
        "sucesso"
      );
    } catch (e) {
      if (!abriu && aba && !aba.closed) aba.close();
      setEtapaTaxa("confirmado");
      setModalTaxaAberto(true);
      setErroTaxa(e instanceof Error ? e.message : "Falha ao abrir a conta digital.");
    } finally {
      abrindoCadastroRef.current = false;
      setAbrindoCadastro(false);
      setAbrindo(false);
    }
  }

  async function abrirContaDigital() {
    const aba = prepararAbaEnvioDocumentos();

    if (subconta?.envioDocumentosPendente) {
      try {
        await abrirEnvioDireto(aba);
      } catch (e) {
        if (aba && !aba.closed) aba.close();
        exibirFeedback(
          e instanceof Error ? e.message : "Falha ao reabrir o envio de documentos.",
          "erro"
        );
      }
      return;
    }

    setAbrindo(true);
    setFeedbackLocal(null);
    try {
      const taxa = await consultarTaxaAtual();
      if (taxa?.paga) {
        await criarContaEAbrir(aba);
        return;
      }
      if (aba && !aba.closed) aba.close();
      setErroTaxa("");
      setEtapaTaxa("aviso");
      setModalTaxaAberto(true);
    } catch (e) {
      if (aba && !aba.closed) aba.close();
      exibirFeedback(
        e instanceof Error ? e.message : "Falha ao abrir conta digital.",
        "erro"
      );
    } finally {
      setAbrindo(false);
    }
  }

  async function aceitarTaxa() {
    const aba = prepararAbaEnvioDocumentos();
    escreverAbaAguardando(aba);
    abaTaxaRef.current = aba;
    setGerandoTaxa(true);
    setErroTaxa("");
    try {
      const res = await fetch("/api/asaas/subconta/taxa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as { error?: string; taxa?: TaxaAbertura };
      if (!res.ok) throw new Error(json.error || "Não foi possível gerar o PIX.");
      if (json.taxa) setTaxaAbertura(json.taxa);
      if (json.taxa?.paga) {
        setEtapaTaxa("confirmado");
        await criarContaEAbrir(aba);
        return;
      }
      setEtapaTaxa("pix");
    } catch (e) {
      if (aba && !aba.closed) aba.close();
      setErroTaxa(e instanceof Error ? e.message : "Não foi possível gerar o PIX.");
    } finally {
      setGerandoTaxa(false);
    }
  }

  useEffect(() => {
    if (!modalTaxaAberto || etapaTaxa !== "pix") return;
    let parado = false;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const taxa = await consultarTaxaAtual();
          if (parado || !taxa?.paga) return;
          setEtapaTaxa("confirmado");
          await criarContaEAbrir(abaTaxaRef.current);
        } catch {
          /* a próxima consulta tenta de novo */
        }
      })();
    }, 4000);
    return () => {
      parado = true;
      window.clearInterval(timer);
    };
  }, [modalTaxaAberto, etapaTaxa]);

  async function atualizarStatus() {
    setAtualizando(true);
    try {
      // Mantém a jornada se o cliente ainda está nesta tela enviando documentos.
      if ((subconta?.status || "nao_iniciado") !== "nao_iniciado") {
        marcarOnboardingAsaasAtivo();
      }
      await carregar();
      exibirFeedback("Status atualizado.", "sucesso");
    } finally {
      setAtualizando(false);
    }
  }

  async function cancelarContaDigital() {
    setCancelando(true);
    setFeedbackLocal(null);
    try {
      const res = await fetch("/api/asaas/subconta", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          motivo: "Cliente solicitou o cancelamento da conta digital no Lab Prótese.",
        }),
      });
      const texto = await res.text();
      let json: { error?: string } = {};
      try {
        json = texto ? (JSON.parse(texto) as { error?: string }) : {};
      } catch {
        throw new Error(texto.slice(0, 200) || "Resposta inválida do servidor.");
      }
      if (!res.ok) {
        throw new Error(json.error || "Não foi possível cancelar a conta digital.");
      }
      limparOnboardingAsaasAtivo();
      setDocumentos([]);
      exibirFeedback(
        "Conta digital cancelada. Para usar de novo, clique em Abrir conta digital. A taxa única de R$ 15,00 será pedida outra vez, porque é uma nova abertura no Asaas.",
        "sucesso"
      );
      await carregar();
    } catch (e) {
      exibirFeedback(
        e instanceof Error ? e.message : "Falha ao cancelar a conta digital.",
        "erro"
      );
    } finally {
      setCancelando(false);
    }
  }

  async function salvarLegado() {
    setSalvandoLegado(true);
    try {
      const res = await fetch("/api/asaas/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ambiente,
          apiKey: apiKey.trim() || undefined,
          manterApiKey: !apiKey.trim() && apiKeyConfigurada,
          webhookToken: webhookToken.startsWith("*") ? undefined : webhookToken,
          manterWebhookToken: webhookToken.startsWith("*"),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Falha ao salvar");
      }
      setApiKey("");
      setApiKeyConfigurada(true);
      exibirFeedback(
        "Integração manual salva. Acesse Financeiro → Conta Digital para saldo, pagamentos e Pix.",
        "sucesso"
      );
    } catch (e) {
      exibirFeedback(
        e instanceof Error ? e.message : "Não foi possível salvar.",
        "erro"
      );
    } finally {
      setSalvandoLegado(false);
    }
  }

  if (carregando) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando…
      </p>
    );
  }

  const status = subconta?.status || "nao_iniciado";
  const retomandoEnvio =
    subconta?.envioDocumentosPendente === true && !documentosReabertos;
  const statusVisivel: StatusSubconta = retomandoEnvio ? "nao_iniciado" : status;
  const badge = rotuloStatus(statusVisivel);
  const BadgeIcon = badge.Icon;
  const contaIniciada =
    Boolean(subconta?.subcontaIniciada) ||
    (status !== "nao_iniciado" &&
      Boolean(subconta?.subcontaCriada || subconta?.asaasAccountId));
  const integracaoManualVisivel = podeUsarIntegracaoManual;
  const saldoAtual =
    typeof subconta?.saldo === "number" && Number.isFinite(subconta.saldo)
      ? subconta.saldo
      : null;
  const saldoZerado = saldoAtual == null || Math.abs(saldoAtual) <= 0.001;
  // Cancelar só com subconta criada no Asaas (não na abertura sem documentos).
  const podeMostrarCancelar =
    Boolean(subconta?.podeExibirCancelarContaDigital) && !integracaoManualVisivel;
  const contaIniciadaVisivel = !retomandoEnvio && contaIniciada;
  const podeAbrir =
    retomandoEnvio ||
    Boolean(subconta?.podeAbrirContaDigital) ||
    (!contaIniciada &&
      subconta?.contaMaeConfigurada !== false &&
      !integracaoManualVisivel);

  return (
    <div className="max-w-2xl space-y-5 text-sm">
      <div className="rounded-lg border border-blue-100 bg-blue-50/80 px-4 py-3 text-[12px] text-slate-700">
        <p className="font-semibold text-slate-800">Conta Digital Asaas</p>
        <p className="mt-1">
          Abra sua conta dentro do Lab Prótese para emitir boletos, receber Pix, pagar contas e
          transferir valores. A abertura da subconta tem taxa única de R$ 15,00, paga no PIX do
          Mercado Pago da assinatura. Após enviar os documentos, a análise leva até 48 horas. Antes de
          abrir, preencha CNPJ, celular e Renda/Faturamento R$ em Dados do laboratório. Se cancelar
          a conta, poderá abrir outra depois — será necessário passar por todo o processo novamente.
        </p>
        <p className="mt-2 text-[11px] text-slate-500">
          Serviços financeiros operados pelo Asaas, instituição de pagamento autorizada pelo Banco
          Central do Brasil.
        </p>
      </div>

      {!subconta?.contaMaeConfigurada ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-900">
          A plataforma ainda não configurou a conta-mãe Asaas no servidor (
          <code className="text-[11px]">ASAAS_CONTA_MAE_API_KEY</code>). Entre em contato com o
          suporte para habilitar contas digitais.
        </div>
      ) : integracaoManualVisivel && apiKeyConfigurada ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] text-emerald-900">
          Integração manual ativa. Boletos e{" "}
          <strong>Financeiro → Conta Digital</strong> (saldo, pagar boleto e Pix) usam sua conta
          Asaas conectada.
        </div>
      ) : integracaoManualVisivel ? (
        <div className="rounded-lg border border-blue-100 bg-blue-50/80 px-4 py-3 text-[12px] text-slate-700">
          O CNPJ deste laboratório é o mesmo da conta-mãe Asaas. Use a{" "}
          <strong>chave API manual (legado)</strong> abaixo em vez de abrir subconta.
        </div>
      ) : null}

      {feedbackLocal ? (
        <div
          role="alert"
          className={cn(
            "rounded-lg border px-4 py-3 text-[12px]",
            feedbackLocal.tipo === "sucesso"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : feedbackLocal.tipo === "erro"
                ? "border-red-200 bg-red-50 text-red-900"
                : "border-slate-200 bg-slate-50 text-slate-700"
          )}
        >
          {feedbackLocal.texto}
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BadgeIcon className={cn("h-5 w-5", badge.cor)} />
            <span className={cn("text-[13px] font-medium", badge.cor)}>{badge.texto}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {contaIniciadaVisivel ? (
              <Button
                type="button"
                variant="secondary"
                disabled={atualizando || cancelando}
                onClick={() => void atualizarStatus()}
              >
                {atualizando ? "Atualizando…" : "Atualizar status"}
              </Button>
            ) : null}
            {podeMostrarCancelar ? (
              <Button
                type="button"
                variant="secondary"
                disabled={cancelando || !saldoZerado}
                className="border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60"
                onClick={() => setConfirmandoCancelamento(true)}
                title={
                  saldoZerado
                    ? "Cancelar conta digital no Asaas"
                    : "Zere o saldo da conta digital antes de cancelar"
                }
              >
                {cancelando ? "Cancelando…" : "Cancelar conta digital"}
              </Button>
            ) : null}
            {podeAbrir ? (
              <Button type="button" disabled={abrindo} onClick={() => void abrirContaDigital()}>
                {abrindo ? "Abrindo conta…" : "Abrir conta digital"}
              </Button>
            ) : null}
          </div>
        </div>

        {subconta?.contaAtiva && subconta.conta ? (
          <p className="mt-3 text-[12px] text-slate-600">
            Conta: Ag. {subconta.agencia || "—"} · Cc {subconta.conta}
            {subconta.contaDigito ? `-${subconta.contaDigito}` : ""}
          </p>
        ) : null}

        {podeMostrarCancelar && saldoAtual != null ? (
          <p className="mt-2 text-[12px] text-slate-600">
            Saldo atual:{" "}
            <strong>
              R${" "}
              {saldoAtual.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </strong>
            {!saldoZerado
              ? " — transfira ou utilize o saldo para liberar o cancelamento."
              : " — cancelamento liberado."}
          </p>
        ) : null}

        {status === "aprovada" ? (
          <p className="mt-3 text-[12px] text-emerald-700">
            Conta aprovada. Boletos nas receitas e a área{" "}
            <strong>Financeiro → Conta Digital</strong> estão liberados.
          </p>
        ) : null}
      </div>

      {!retomandoEnvio && documentos.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-[13px] font-medium text-slate-800">Documentos para aprovação</h3>
          {documentos.map((doc) => {
            const statusDoc = rotuloStatusDocumento(doc.status);
            return (
              <div
                key={doc.id}
                className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"
              >
                <p className="text-[13px] font-medium text-slate-800">{doc.title}</p>
                {doc.description ? (
                  <p className="mt-1 text-[12px] text-slate-600">{doc.description}</p>
                ) : null}
                {statusDoc ? (
                  <p className={cn("mt-1 text-[11px] font-medium", statusDoc.cor)}>
                    Status: {statusDoc.texto}
                  </p>
                ) : null}
                {doc.onboardingUrl ? (
                  <a
                    href={doc.onboardingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 rounded bg-[#4a90d9] px-3 py-1.5 text-[12px] text-white hover:bg-[#3d7fc4]"
                  >
                    Enviar documentos
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : !retomandoEnvio && contaIniciada && status !== "aprovada" ? (
        <p className="text-[12px] text-slate-500">
          Aguardando lista de documentos do Asaas. Clique em &quot;Atualizar status&quot; em alguns
          segundos.
        </p>
      ) : null}

      {integracaoManualVisivel ? (
      <div className="border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={() => setModoLegado((v) => !v)}
          className="text-[12px] text-slate-500 underline hover:text-slate-700"
        >
          {modoLegado ? "Ocultar integração manual" : "Usar chave API manual (legado)"}
        </button>

        {modoLegado ? (
          <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-[11px] text-slate-600">
              Para o laboratório com o mesmo CNPJ da conta-mãe Asaas (chave da plataforma).
            </p>
            <div>
              <label className={labelClass}>Ambiente</label>
              <select
                value={ambiente}
                onChange={(e) =>
                  setAmbiente(e.target.value === "producao" ? "producao" : "sandbox")
                }
                className={inputClass}
              >
                <option value="sandbox">Sandbox</option>
                <option value="producao">Produção</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Chave da API</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  apiKeyConfigurada ? "Deixe em branco para manter" : "Cole a chave Asaas"
                }
                className={inputClass}
                autoComplete="off"
              />
            </div>
            <div>
              <label className={labelClass}>Token webhook (opcional)</label>
              <input
                type="text"
                value={webhookToken}
                onChange={(e) => setWebhookToken(e.target.value)}
                className={inputClass}
              />
              {webhookUrl ? (
                <p className="mt-1 break-all text-[11px] text-slate-500">{webhookUrl}</p>
              ) : null}
            </div>
            <Button type="button" disabled={salvandoLegado} onClick={() => void salvarLegado()}>
              {salvandoLegado ? "Salvando…" : "Gravar integração manual"}
            </Button>
          </div>
        ) : null}
      </div>
      ) : null}

      <AsaasSeloInstitucional
        detalhado
        className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-5"
      />

      <TaxaAberturaSubcontaModal
        open={modalTaxaAberto}
        etapa={etapaTaxa}
        pixPayload={taxaAbertura?.cobranca?.pixPayload || null}
        pixEncodedImage={taxaAbertura?.cobranca?.pixEncodedImage || null}
        erro={erroTaxa}
        gerando={gerandoTaxa}
        abrindoCadastro={abrindoCadastro}
        onClose={() => {
          if (etapaTaxa === "pix" && abaTaxaRef.current && !abaTaxaRef.current.closed) {
            abaTaxaRef.current.close();
          }
          setModalTaxaAberto(false);
          setErroTaxa("");
        }}
        onAceitar={() => void aceitarTaxa()}
        onAbrirCadastro={() => {
          const aba =
            abaTaxaRef.current && !abaTaxaRef.current.closed
              ? abaTaxaRef.current
              : prepararAbaEnvioDocumentos();
          abaTaxaRef.current = aba;
          void criarContaEAbrir(aba);
        }}
      />

      <ConfirmacaoExclusaoModal
        open={confirmandoCancelamento}
        titulo="Cancelar conta digital"
        mensagem="Deseja cancelar definitivamente a conta digital Asaas deste laboratório?"
        aviso="Esta ação é irreversível na conta atual. Só é permitida com saldo zerado e sem cobranças ou saques pendentes. Depois você poderá abrir uma nova conta, pagando de novo a taxa única de R$ 15,00 e refazendo documentos e análise."
        detalhe={
          saldoAtual != null
            ? `Saldo atual: R$ ${saldoAtual.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            : undefined
        }
        onClose={() => setConfirmandoCancelamento(false)}
        onConfirm={() => void cancelarContaDigital()}
        processando={cancelando}
        labelConfirmar="Sim, cancelar"
        labelCancelar="Não"
      />
    </div>
  );
}
