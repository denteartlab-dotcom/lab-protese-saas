"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import Link from "next/link";
import {
  Bell,
  Clock,
  Copy,
  FileText,
  HelpCircle,
  MessageCircle,
  Pause,
  Play,
  Plus,
  ThumbsDown,
  Trash2,
  Users,
} from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { ConfirmacaoExclusaoModal } from "@/components/ConfirmacaoExclusaoModal";
import { CampanhaWizardInline } from "@/components/disparos-whatsapp/CampanhaWizardInline";
import { DisparosMetricCard } from "@/components/disparos-whatsapp/DisparosMetricCard";
import { DisparosToast, type ToastDisparo } from "@/components/disparos-whatsapp/DisparosToast";
import { ProgressoCircular } from "@/components/disparos-whatsapp/ProgressoCircular";
import { useDisparosSocket } from "@/hooks/useDisparosSocket";
import {
  estimarDuracaoDisparo,
  formatarTempoRestante,
} from "@/lib/whatsapp-disparos/mensagem-variaveis";
import type { CampanhaPublica } from "@/lib/whatsapp-disparos/campanha-servidor";
import type { DiagnosticoWhatsapp } from "@/lib/whatsapp-disparos/diagnostico-conexao";

type DashboardData = {
  conexao: {
    conectado: boolean;
    baileysOnline?: boolean;
    numero: string | null;
    ultimaConexao: string | null;
    qr: string | null;
    status: string;
    pareamentoEmAndamento?: boolean;
    pairingBlocked?: boolean;
    pairingBlockedUntil?: string | null;
  };
  metricas: {
    totalCampanhas: number;
    enviadasHoje: number;
    pendentes: number;
    falhas: number;
  };
};

type ContatoFila = {
  id: string;
  nome: string;
  telefone: string;
  status: string;
  tentativas: number;
  erro: string | null;
  horario: string;
};

function fmt(n: number) {
  return n.toLocaleString("pt-BR");
}

function fmtUltimaConexao(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  const hoje = new Date();
  const mesmoDia =
    d.getDate() === hoje.getDate() &&
    d.getMonth() === hoje.getMonth() &&
    d.getFullYear() === hoje.getFullYear();
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return mesmoDia ? `Hoje às ${hora}` : d.toLocaleString("pt-BR");
}

function statusCampanhaBadge(status: string) {
  const map: Record<string, string> = {
    rascunho: "bg-slate-100 text-slate-600",
    agendada: "bg-blue-50 text-blue-700",
    enviando: "bg-blue-50 text-blue-700",
    pausada: "bg-amber-50 text-amber-700",
    concluida: "bg-emerald-50 text-emerald-700",
    cancelada: "bg-slate-100 text-slate-500",
  };
  return map[status] || "bg-slate-100 text-slate-600";
}

function labelStatusCampanha(status: string) {
  const map: Record<string, string> = {
    rascunho: "Rascunho",
    agendada: "Agendada",
    enviando: "Em andamento",
    pausada: "Pausada",
    concluida: "Finalizada",
    cancelada: "Cancelada",
  };
  return map[status] || status;
}

export function DisparosWhatsappConteudo() {
  const wizardRef = useRef<HTMLDivElement>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [campanhas, setCampanhas] = useState<CampanhaPublica[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [wizardReset, setWizardReset] = useState(0);
  const [campanhaAtiva, setCampanhaAtiva] = useState<CampanhaPublica | null>(null);
  const [progresso, setProgresso] = useState<{
    percentual: number;
    tempoRestanteSegundos: number;
    enviadas: number;
    pendentes: number;
    falhas: number;
    total: number;
  } | null>(null);
  const [fila, setFila] = useState<ContatoFila[]>([]);
  const [qrImagem, setQrImagem] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastDisparo[]>([]);
  const [excluirId, setExcluirId] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [socketOnline, setSocketOnline] = useState(false);
  const [aguardandoQr, setAguardandoQr] = useState(false);
  const [qrModalAberto, setQrModalAberto] = useState(false);
  const [apiNaoAutorizada, setApiNaoAutorizada] = useState(false);
  const [diagnostico, setDiagnostico] = useState<DiagnosticoWhatsapp | null>(null);
  const ultimoQrRef = useRef<string | null>(null);
  const qrModalAbertoRef = useRef(false);

  const toast = useCallback((tipo: ToastDisparo["tipo"], mensagem: string) => {
    setToasts((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, tipo, mensagem }]);
  }, []);

  const aplicarQr = useCallback(async (qr: string | null, opts?: { forcarModal?: boolean }) => {
    if (!qr) {
      if (!dashboard?.conexao?.conectado) {
        setQrImagem(null);
        ultimoQrRef.current = null;
      }
      return false;
    }

    const mesmoQr = ultimoQrRef.current === qr;
    ultimoQrRef.current = qr;

    try {
      if (!mesmoQr || !qrImagem) {
        const img = await QRCode.toDataURL(qr, { width: 280, margin: 2 });
        setQrImagem(img);
      }
      setAguardandoQr(false);
      if (opts?.forcarModal || !qrModalAbertoRef.current) {
        setQrModalAberto(true);
      }
      return true;
    } catch {
      setAguardandoQr(false);
      return false;
    }
  }, [dashboard?.conexao?.conectado, qrImagem]);

  useEffect(() => {
    qrModalAbertoRef.current = qrModalAberto;
  }, [qrModalAberto]);

  const carregarDiagnostico = useCallback(async () => {
    try {
      const res = await fetch("/api/disparos-whatsapp/diagnostico", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (res.ok) setDiagnostico((await res.json()) as DiagnosticoWhatsapp);
    } catch {
      /* ignora */
    }
  }, []);

  const recarregar = useCallback(async () => {
    try {
      const opts: RequestInit = { cache: "no-store", credentials: "same-origin" };
      const [dashRes, campRes] = await Promise.all([
        fetch("/api/disparos-whatsapp/conexao", opts),
        fetch("/api/disparos-whatsapp/campanhas", opts),
      ]);

      if (dashRes.ok) {
        setApiNaoAutorizada(false);
        const dash = (await dashRes.json()) as DashboardData;
        if (dash?.conexao) {
          setDashboard(dash);
          if (dash.conexao.qr) {
            await aplicarQr(dash.conexao.qr);
          } else if (dash.conexao.conectado) {
            setQrImagem(null);
            setAguardandoQr(false);
          } else if (dash.conexao.status !== "aguardando_qr") {
            setQrImagem(null);
          }
        }
      } else if (dashRes.status === 401 || campRes.status === 401) {
        setAguardandoQr(false);
        setApiNaoAutorizada(true);
      }

      if (campRes.ok) {
        const campData = (await campRes.json()) as { campanhas?: CampanhaPublica[] };
        setCampanhas(campData.campanhas ?? []);
      }
    } catch {
      setAguardandoQr(false);
    } finally {
      setCarregando(false);
    }
  }, [aplicarQr]);

  useEffect(() => {
    if (!aguardandoQr) return;
    const timeout = window.setTimeout(() => {
      setAguardandoQr(false);
      toast(
        "erro",
        "Tempo esgotado aguardando o QR. Reinicie o serviço: pm2 restart lab-protese-whatsapp"
      );
    }, 90_000);
    return () => window.clearTimeout(timeout);
  }, [aguardandoQr, toast]);

  useEffect(() => {
    void recarregar();
    void carregarDiagnostico();
    if (apiNaoAutorizada) return;
    const intervalo = aguardandoQr ? 4000 : 10000;
    const timer = window.setInterval(() => {
      void recarregar();
      void carregarDiagnostico();
    }, intervalo);
    return () => window.clearInterval(timer);
  }, [recarregar, carregarDiagnostico, aguardandoQr, apiNaoAutorizada]);

  useDisparosSocket({
    onSocketStatus: setSocketOnline,
    onConexao: (payload) => {
      setDashboard((prev) => {
        const conexao = {
          conectado: payload.conectado,
          baileysOnline: true,
          numero: payload.numero,
          ultimaConexao: payload.ultimaConexao,
          qr: payload.qr,
          status: payload.conectado
            ? "conectado"
            : payload.qr
              ? "aguardando_qr"
              : "desconectado",
        };
        if (prev) {
          return { ...prev, conexao };
        }
        return {
          conexao,
          metricas: { totalCampanhas: 0, enviadasHoje: 0, pendentes: 0, falhas: 0 },
        };
      });
      if (payload.conectado) {
        setAguardandoQr(false);
        setQrImagem(null);
        ultimoQrRef.current = null;
      } else if (payload.qr) {
        void aplicarQr(payload.qr);
      }
    },
    onQr: async (qr) => {
      await aplicarQr(qr);
    },
    onProgresso: (p) => {
      setProgresso({
        percentual: p.percentual,
        tempoRestanteSegundos: p.tempoRestanteSegundos,
        enviadas: p.enviadas,
        pendentes: p.pendentes,
        falhas: p.falhas,
        total: p.total,
      });
      setCampanhas((prev) =>
        prev.map((c) =>
          c.id === p.campaignId
            ? { ...c, status: p.status, enviadas: p.enviadas, pendentes: p.pendentes, falhas: p.falhas }
            : c
        )
      );
    },
    onContato: (c) => {
      setFila((prev) => {
        const rest = prev.filter((item) => item.id !== c.contactId);
        return [
          {
            id: c.contactId,
            nome: c.nome,
            telefone: c.telefone,
            status: c.status,
            tentativas: c.tentativas,
            erro: c.erro,
            horario: c.enviadoEm || new Date().toISOString(),
          },
          ...rest,
        ].slice(0, 80);
      });
    },
  });

  async function gerarQr(reset = false) {
    if (conexao?.status === "pareamento" && !reset) {
      toast("info", "Pareamento em andamento — aguarde até 30s após escanear o QR.");
      return;
    }
    setProcessando(true);
    setAguardandoQr(true);
    if (reset) {
      setQrImagem(null);
      ultimoQrRef.current = null;
    }
    try {
      const res = await fetch("/api/disparos-whatsapp/conexao", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reset ? { reset: true } : {}),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        qr?: string | null;
        baileysOnline?: boolean;
        conectado?: boolean;
        pareamentoEmAndamento?: boolean;
        pairingBlocked?: boolean;
        pairingBlockedUntil?: string | null;
        mensagem?: string;
      };

      if (!res.ok) {
        if (data.pairingBlocked) {
          toast(
            "erro",
            data.error ||
              "WhatsApp bloqueou novos dispositivos. Aguarde 24h antes de tentar de novo."
          );
          void recarregar();
          return;
        }
        if (data.pareamentoEmAndamento) {
          toast("info", data.error || "Aguarde — pareamento em andamento.");
          return;
        }
        throw new Error(data.error || "Falha ao gerar QR");
      }

      if (data.mensagem) {
        toast("info", data.mensagem);
      }

      if (data.conectado) {
        setAguardandoQr(false);
        toast("sucesso", "WhatsApp já está conectado.");
        void recarregar();
        return;
      }

      if (data.pareamentoEmAndamento) {
        toast("info", "QR escaneado — aguarde até 30s. Não clique em Gerar QR novamente.");
        return;
      }

      if (data.qr) {
        const ok = await aplicarQr(data.qr, { forcarModal: true });
        if (ok) {
          toast("sucesso", "Escaneie o QR UMA vez e aguarde ~30s. Não clique de novo.");
          return;
        }
      }

      void recarregar();
      void carregarDiagnostico();
    } catch (err) {
      setAguardandoQr(false);
      toast("erro", err instanceof Error ? err.message : "Erro ao gerar QR Code");
      void carregarDiagnostico();
    } finally {
      setProcessando(false);
    }
  }

  async function resetarSessaoWhatsapp() {
    if (!window.confirm("Resetar sessão WhatsApp? Será necessário escanear QR novamente.")) return;
    await gerarQr(true);
  }

  async function desconectar() {
    if (!window.confirm("Desconectar o WhatsApp deste laboratório?")) return;
    setProcessando(true);
    try {
      await fetch("/api/disparos-whatsapp/conexao/desconectar", { method: "POST" });
      toast("sucesso", "WhatsApp desconectado.");
      void recarregar();
    } finally {
      setProcessando(false);
    }
  }

  async function acaoCampanha(id: string, acao: "iniciar" | "pausar" | "continuar" | "cancelar" | "duplicar") {
    setProcessando(true);
    try {
      const res = await fetch(`/api/disparos-whatsapp/campanhas/${id}/${acao}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha na operação");
      if (acao === "iniciar" || acao === "continuar") {
        const camp = campanhas.find((c) => c.id === id) || data.campanha;
        if (camp) await abrirCampanha(camp);
      }
      if (acao === "cancelar") {
        setCampanhaAtiva(null);
        setProgresso(null);
      }
      toast("sucesso", `Campanha ${acao === "duplicar" ? "duplicada" : "atualizada"}.`);
      void recarregar();
    } catch (err) {
      toast("erro", err instanceof Error ? err.message : "Erro na campanha");
    } finally {
      setProcessando(false);
    }
  }

  async function abrirCampanha(c: CampanhaPublica) {
    setCampanhaAtiva(c);
    const res = await fetch(`/api/disparos-whatsapp/campanhas/${c.id}/contatos?limite=80`);
    const data = (await res.json()) as { contatos: ContatoFila[] };
    setFila(data.contatos || []);
    if (c.status === "enviando" || c.status === "pausada") {
      setProgresso({
        percentual: c.totalContatos ? Math.round((c.enviadas / c.totalContatos) * 100) : 0,
        tempoRestanteSegundos: estimarDuracaoDisparo(c.pendentes, c.intervaloSegundos, c.atrasoAleatorio),
        enviadas: c.enviadas,
        pendentes: c.pendentes,
        falhas: c.falhas,
        total: c.totalContatos,
      });
    } else {
      setProgresso(null);
    }
  }

  function scrollParaWizard() {
    setWizardReset((n) => n + 1);
    wizardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (carregando && !dashboard) {
    return (
      <div className="space-y-5">
        <div className="h-14 animate-pulse rounded-xl bg-slate-200" />
        <div className="grid gap-4 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[118px] animate-pulse rounded-xl bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  const conexao = dashboard?.conexao;
  const metricas = dashboard?.metricas;
  const emDisparo =
    campanhaAtiva && (campanhaAtiva.status === "enviando" || campanhaAtiva.status === "pausada") && progresso;

  const pctProgresso = emDisparo ? progresso.percentual : 0;
  const dadosProgresso = emDisparo
    ? progresso
    : { enviadas: 0, pendentes: 0, falhas: 0, total: 0, tempoRestanteSegundos: 0 };

  return (
    <div className="space-y-5">
      {apiNaoAutorizada ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Passo 1 — Sessão inválida (erro 401)</p>
          <p className="mt-1">
            Saia e entre de novo usando sempre o mesmo endereço (com ou sem www).{" "}
            <Link href="/login" className="font-semibold underline">
              Ir para login
            </Link>
          </p>
        </div>
      ) : null}

      {diagnostico && !diagnostico.urlConfigurada && !apiNaoAutorizada ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">WHATSAPP_HTTP_URL vazio no .env</p>
          <p className="mt-1">Adicione esta linha e reinicie o PM2:</p>
          <pre className="mt-2 overflow-x-auto rounded bg-amber-100/80 p-2 text-xs">
            WHATSAPP_HTTP_URL=http://127.0.0.1:3100/send
          </pre>
        </div>
      ) : null}

      {diagnostico && !diagnostico.baileysOnline && !apiNaoAutorizada ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p className="font-semibold">Passo 2 — Serviço Baileys offline</p>
          <p className="mt-1">Na VPS execute:</p>
          <pre className="mt-2 overflow-x-auto rounded bg-red-100/80 p-2 text-xs">
            pm2 restart lab-protese-whatsapp{"\n"}
            npm run whatsapp:diagnostico
          </pre>
        </div>
      ) : null}

      {diagnostico?.tokenConfigurado && diagnostico.baileysOnline && !apiNaoAutorizada ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900">
          Token configurado: confira se <code className="rounded bg-blue-100 px-1">WHATSAPP_HTTP_TOKEN</code> é
          idêntico no .env (ou deixe vazio nos dois processos).
        </div>
      ) : null}
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366] shadow-sm">
            <MessageCircle className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Disparos WhatsApp</h1>
            <p className="text-sm text-slate-500">Crie e gerencie campanhas de WhatsApp.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            aria-label="Notificações"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
              3
            </span>
          </button>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            aria-label="Ajuda"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
          <Button
            onClick={scrollParaWizard}
            className="h-9 bg-indigo-600 px-4 text-sm font-medium shadow-sm hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Nova Campanha
          </Button>
        </div>
      </div>

      {/* 5 cards superiores */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {/* Conexão */}
        <div className="flex min-h-[118px] flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-medium text-slate-500">Conexão WhatsApp</p>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                conexao?.conectado
                  ? "bg-emerald-50 text-emerald-700"
                  : conexao?.baileysOnline === false
                    ? "bg-red-50 text-red-700"
                    : aguardandoQr || conexao?.status === "aguardando_qr"
                      ? "bg-blue-50 text-blue-700"
                      : conexao?.status === "pareamento"
                        ? "bg-violet-50 text-violet-700"
                      : "bg-amber-50 text-amber-700"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  conexao?.conectado
                    ? "bg-emerald-500"
                    : conexao?.baileysOnline === false
                      ? "bg-red-500"
                      : aguardandoQr || conexao?.status === "aguardando_qr"
                        ? "bg-blue-500 animate-pulse"
                        : conexao?.status === "pareamento"
                          ? "bg-violet-500 animate-pulse"
                        : "bg-amber-500"
                }`}
              />
              {conexao?.conectado
                ? "Conectado"
                : conexao?.baileysOnline === false
                  ? "Serviço offline"
                  : aguardandoQr || conexao?.status === "aguardando_qr"
                    ? "Aguardando QR"
                    : conexao?.status === "pareamento"
                    ? "Finalizando…"
                    : conexao?.status === "bloqueado_whatsapp"
                      ? "Bloqueado"
                    : "Desconectado"}
            </span>
          </div>
          <div className="mt-2 flex items-end justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">
                {conexao?.numero || "+55 — — — — — —"}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                Última conexão: {fmtUltimaConexao(conexao?.ultimaConexao)}
              </p>
              {!socketOnline ? (
                <p className="mt-1 text-[10px] font-medium text-amber-600">
                  WebSocket offline — use npm run dev:server ou pm2 restart lab-protese
                </p>
              ) : null}
              {conexao?.baileysOnline === false ? (
                <p className="mt-1 text-[10px] font-medium text-red-600">
                  Baileys offline — npm run whatsapp:baileys
                </p>
              ) : null}
              {conexao?.status === "bloqueado_whatsapp" ? (
                <p className="mt-1 text-[10px] font-medium text-red-600">
                  WhatsApp bloqueou novos aparelhos. Aguarde ~24h. No celular: Aparelhos conectados →
                  remova sessões antigas. Não clique em Gerar QR.
                  {conexao.pairingBlockedUntil
                    ? ` Libera ~${new Date(conexao.pairingBlockedUntil).toLocaleString("pt-BR")}.`
                    : null}
                </p>
              ) : null}
              {conexao?.status === "pareamento" ? (
                <p className="mt-1 text-[10px] font-medium text-violet-600">
                  QR escaneado — aguarde ~30s sem clicar em nada.
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {!conexao?.conectado ? (
                  <button
                    type="button"
                    onClick={() => void gerarQr()}
                    disabled={
                      processando ||
                      conexao?.baileysOnline === false ||
                      conexao?.status === "pareamento" ||
                      conexao?.status === "bloqueado_whatsapp"
                    }
                    className="rounded-md bg-indigo-600 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {processando
                      ? "Aguarde…"
                      : conexao?.status === "pareamento"
                        ? "Conectando…"
                        : "Gerar QR Code"}
                  </button>
                ) : null}
                {!conexao?.conectado ? (
                  <button
                    type="button"
                    onClick={() => void resetarSessaoWhatsapp()}
                    disabled={processando || conexao?.baileysOnline === false}
                    className="rounded-md border border-slate-200 px-2.5 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Resetar sessão
                  </button>
                ) : null}
                {conexao?.conectado ? (
                  <button
                    type="button"
                    onClick={() => void desconectar()}
                    disabled={processando}
                    className="rounded-md border border-red-200 px-2.5 py-1 text-[10px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Desconectar
                  </button>
                ) : null}
              </div>
            </div>
            {qrImagem ? (
              <button
                type="button"
                onClick={() => setQrModalAberto(true)}
                title="Ver QR Code"
                className="shrink-0 rounded-lg border border-slate-200 p-0.5 hover:border-indigo-300"
              >
                <img src={qrImagem} alt="QR Code WhatsApp" className="h-16 w-16 rounded-md" />
              </button>
            ) : aguardandoQr ? (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-indigo-200 bg-indigo-50">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              </div>
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-dashed border-slate-200 bg-slate-50">
                <div className="grid grid-cols-3 gap-0.5 p-1">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <span key={i} className="h-1 w-1 rounded-sm bg-slate-300" />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <DisparosMetricCard
          titulo="Campanhas"
          valor={fmt(metricas?.totalCampanhas ?? 0)}
          subtitulo="Total de campanhas"
          icon={FileText}
          tom="indigo"
        />
        <DisparosMetricCard
          titulo="Enviados Hoje"
          valor={fmt(metricas?.enviadasHoje ?? 0)}
          subtitulo="Mensagens enviadas"
          icon={Users}
          tom="emerald"
        />
        <DisparosMetricCard
          titulo="Pendentes"
          valor={fmt(metricas?.pendentes ?? 0)}
          subtitulo="Aguardando envio"
          icon={Clock}
          tom="amber"
        />
        <DisparosMetricCard
          titulo="Falhas"
          valor={fmt(metricas?.falhas ?? 0)}
          subtitulo="Não foram entregues"
          icon={ThumbsDown}
          tom="rose"
        />
      </div>

      {/* Campanhas + Progresso */}
      <div className="grid gap-4 xl:grid-cols-12">
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] xl:col-span-7">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-800">Campanhas recentes</h2>
            <Link href="/app/disparos-whatsapp/historico" className="text-xs font-medium text-indigo-600 hover:underline">
              Ver todas
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  {["Nome da Campanha", "Data", "Contatos", "Enviados", "Pendentes", "Falhas", "Status", ""].map(
                    (h) => (
                      <th key={h} className="whitespace-nowrap px-4 py-2.5 font-medium">
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {campanhas.slice(0, 6).map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => void abrirCampanha(c)}
                    className={`cursor-pointer border-b border-slate-50 transition-colors hover:bg-slate-50/80 ${
                      campanhaAtiva?.id === c.id ? "bg-indigo-50/40" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">{c.nome}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                      {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{fmt(c.totalContatos)}</td>
                    <td className="px-4 py-3 font-medium text-emerald-700">{fmt(c.enviadas)}</td>
                    <td className="px-4 py-3 font-medium text-amber-700">{fmt(c.pendentes)}</td>
                    <td className="px-4 py-3 font-medium text-red-600">{fmt(c.falhas)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusCampanhaBadge(c.status)}`}
                      >
                        {labelStatusCampanha(c.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        {(c.status === "rascunho" || c.status === "agendada") && (
                          <button
                            type="button"
                            title="Iniciar"
                            onClick={() => void acaoCampanha(c.id, "iniciar")}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
                          >
                            <Play className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          title="Duplicar"
                          onClick={() => void acaoCampanha(c.id, "duplicar")}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Excluir"
                          onClick={() => setExcluirId(c.id)}
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!campanhas.length && (
            <p className="py-12 text-center text-sm text-slate-400">Nenhuma campanha criada ainda.</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] xl:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Progresso do disparo</h2>
            {emDisparo && campanhaAtiva.status === "enviando" ? (
              <button
                type="button"
                onClick={() => void acaoCampanha(campanhaAtiva.id, "pausar")}
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
              >
                <Pause className="h-3 w-3" /> Pausar
              </button>
            ) : emDisparo && campanhaAtiva.status === "pausada" ? (
              <button
                type="button"
                onClick={() => void acaoCampanha(campanhaAtiva.id, "continuar")}
                className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-700"
              >
                <Play className="h-3 w-3" /> Continuar
              </button>
            ) : null}
          </div>

          <ProgressoCircular
            percentual={pctProgresso}
            legenda={[
              { label: "Enviados", valor: dadosProgresso.enviadas, cor: "text-emerald-700" },
              { label: "Pendentes", valor: dadosProgresso.pendentes, cor: "text-amber-700" },
              { label: "Falhas", valor: dadosProgresso.falhas, cor: "text-red-600" },
              { label: "Total", valor: dadosProgresso.total, cor: "text-slate-800" },
            ]}
          />

          <div className="mt-4 space-y-1 border-t border-slate-100 pt-4 text-[11px] text-slate-500">
            <p>
              Tempo restante:{" "}
              <strong className="text-slate-700">
                {emDisparo ? formatarTempoRestante(dadosProgresso.tempoRestanteSegundos) : "—"}
              </strong>
            </p>
            <p>
              Velocidade:{" "}
              <strong className="text-slate-700">
                {emDisparo ? `${campanhaAtiva.intervaloSegundos} seg` : "—"} por mensagem
              </strong>
            </p>
            {campanhaAtiva ? (
              <p className="truncate font-medium text-indigo-600">{campanhaAtiva.nome}</p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Wizard inline — igual ao mockup */}
      <div ref={wizardRef}>
        <CampanhaWizardInline
          conectado={Boolean(conexao?.conectado)}
          fila={fila}
          resetSignal={wizardReset}
          onSalvo={() => {
            toast("sucesso", "Campanha salva com sucesso.");
            void recarregar();
          }}
          onIniciado={() => {
            toast("sucesso", "Disparo iniciado.");
            void recarregar();
          }}
        />
      </div>

      <ConfirmacaoExclusaoModal
        open={Boolean(excluirId)}
        titulo="Excluir campanha"
        mensagem="Esta ação não pode ser desfeita. Deseja excluir a campanha?"
        onClose={() => setExcluirId(null)}
        onConfirm={async () => {
          if (!excluirId) return;
          await fetch(`/api/disparos-whatsapp/campanhas/${excluirId}`, { method: "DELETE" });
          setExcluirId(null);
          toast("sucesso", "Campanha excluída.");
          void recarregar();
        }}
      />

      <Modal
        open={qrModalAberto && Boolean(qrImagem)}
        onClose={() => setQrModalAberto(false)}
        title="Escaneie o QR Code"
        size="sm"
      >
        <div className="flex flex-col items-center gap-4 py-2">
          {qrImagem ? (
            <img src={qrImagem} alt="QR Code WhatsApp" className="h-64 w-64 rounded-xl border border-slate-200" />
          ) : null}
          <p className="text-center text-sm text-slate-600">
            No WhatsApp do celular: <strong>Menu → Aparelhos conectados → Conectar aparelho</strong>
          </p>
          <Button variant="outline" onClick={() => setQrModalAberto(false)}>
            Fechar
          </Button>
        </div>
      </Modal>

      <DisparosToast toasts={toasts} onRemover={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </div>
  );
}
