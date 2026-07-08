"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Copy,
  Download,
  History,
  MessageCircle,
  Pause,
  Play,
  Plus,
  QrCode,
  RefreshCw,
  Send,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { Button, Table } from "@/components/ui";
import { ConfirmacaoExclusaoModal } from "@/components/ConfirmacaoExclusaoModal";
import { CampanhaWizardModal } from "@/components/disparos-whatsapp/CampanhaWizardModal";
import { DisparosMetricCard } from "@/components/disparos-whatsapp/DisparosMetricCard";
import { DisparosToast, type ToastDisparo } from "@/components/disparos-whatsapp/DisparosToast";
import { ProgressoCircular } from "@/components/disparos-whatsapp/ProgressoCircular";
import { useDisparosSocket } from "@/hooks/useDisparosSocket";
import {
  estimarDuracaoDisparo,
  formatarTempoRestante,
} from "@/lib/whatsapp-disparos/mensagem-variaveis";
import type { CampanhaPublica } from "@/lib/whatsapp-disparos/campanha-servidor";

type DashboardData = {
  conexao: {
    conectado: boolean;
    numero: string | null;
    ultimaConexao: string | null;
    qr: string | null;
    status: string;
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

function statusBadge(status: string) {
  const map: Record<string, string> = {
    rascunho: "bg-slate-100 text-slate-700",
    agendada: "bg-blue-100 text-blue-800",
    enviando: "bg-indigo-100 text-indigo-800",
    pausada: "bg-amber-100 text-amber-800",
    concluida: "bg-emerald-100 text-emerald-800",
    cancelada: "bg-slate-200 text-slate-600",
    enviado: "bg-emerald-100 text-emerald-800",
    aguardando: "bg-amber-100 text-amber-800",
    falhou: "bg-red-100 text-red-800",
    pausado: "bg-slate-100 text-slate-600",
    cancelado: "bg-slate-100 text-slate-500",
  };
  return map[status] || "bg-slate-100 text-slate-700";
}

function labelStatus(status: string) {
  const map: Record<string, string> = {
    rascunho: "Rascunho",
    agendada: "Agendada",
    enviando: "Em andamento",
    pausada: "Pausada",
    concluida: "Finalizada",
    cancelada: "Cancelada",
    enviado: "Enviado",
    aguardando: "Aguardando",
    falhou: "Falhou",
    pausado: "Pausado",
    cancelado: "Cancelado",
  };
  return map[status] || status;
}

function dotStatus(status: string) {
  if (status === "enviado") return "🟢";
  if (status === "aguardando" || status === "pausado") return "🟡";
  if (status === "falhou") return "🔴";
  if (status === "pausada" || status === "enviando") return "⏸";
  return "⚪";
}

export function DisparosWhatsappConteudo() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [campanhas, setCampanhas] = useState<CampanhaPublica[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [wizardAberto, setWizardAberto] = useState(false);
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

  const toast = useCallback((tipo: ToastDisparo["tipo"], mensagem: string) => {
    setToasts((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, tipo, mensagem }]);
  }, []);

  const recarregar = useCallback(async () => {
    try {
      const [dashRes, campRes] = await Promise.all([
        fetch("/api/disparos-whatsapp/conexao", { cache: "no-store" }),
        fetch("/api/disparos-whatsapp/campanhas", { cache: "no-store" }),
      ]);
      const dash = (await dashRes.json()) as DashboardData;
      const campData = (await campRes.json()) as { campanhas: CampanhaPublica[] };
      setDashboard(dash);
      setCampanhas(campData.campanhas || []);
      if (dash.conexao.qr) {
        const img = await QRCode.toDataURL(dash.conexao.qr, { width: 160, margin: 1 });
        setQrImagem(img);
      } else {
        setQrImagem(null);
      }
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
    const timer = window.setInterval(() => void recarregar(), 8000);
    return () => window.clearInterval(timer);
  }, [recarregar]);

  useDisparosSocket({
    onConexao: (payload) => {
      setDashboard((prev) =>
        prev
          ? {
              ...prev,
              conexao: {
                ...prev.conexao,
                conectado: payload.conectado,
                numero: payload.numero,
                ultimaConexao: payload.ultimaConexao,
                qr: payload.qr,
                status: payload.conectado ? "conectado" : payload.qr ? "aguardando_qr" : "desconectado",
              },
            }
          : prev
      );
    },
    onQr: async (qr) => {
      if (qr) {
        const img = await QRCode.toDataURL(qr, { width: 160, margin: 1 });
        setQrImagem(img);
      } else setQrImagem(null);
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

  async function gerarQr() {
    setProcessando(true);
    try {
      const res = await fetch("/api/disparos-whatsapp/conexao", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao gerar QR");
      toast("sucesso", "QR Code atualizado. Escaneie com o WhatsApp do laboratório.");
      void recarregar();
    } catch (err) {
      toast("erro", err instanceof Error ? err.message : "Erro ao gerar QR Code");
    } finally {
      setProcessando(false);
    }
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
        if (camp) {
          setCampanhaAtiva(camp);
          await abrirCampanha(camp);
        }
      }
      if (acao === "cancelar") {
        setCampanhaAtiva(null);
        setProgresso(null);
      }
      toast("sucesso", `Campanha ${acao === "duplicar" ? "duplicada" : "atualizada"} com sucesso.`);
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

  if (carregando && !dashboard) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-72 animate-pulse rounded-lg bg-slate-200" />
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="h-44 animate-pulse rounded-xl bg-slate-200 lg:col-span-5" />
          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-7 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-200" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const conexao = dashboard?.conexao;
  const metricas = dashboard?.metricas;
  const emDisparo =
    campanhaAtiva && (campanhaAtiva.status === "enviando" || campanhaAtiva.status === "pausada") && progresso;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Disparos WhatsApp
          </h1>
          <p className="mt-1 text-sm text-slate-500">Crie e gerencie campanhas de WhatsApp.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/disparos-whatsapp/historico">
            <Button variant="outline" size="sm" className="border-slate-300">
              <History className="h-4 w-4" />
              Histórico
            </Button>
          </Link>
          <Button
            onClick={() => setWizardAberto(true)}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Nova Campanha
          </Button>
        </div>
      </div>

      {/* Cards superiores */}
      <div className="grid gap-4 lg:grid-cols-12">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-5 dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Conexão WhatsApp</h2>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                    conexao?.conectado ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${conexao?.conectado ? "bg-emerald-500" : "bg-amber-500"}`} />
                  {conexao?.conectado ? "Conectado" : "Desconectado"}
                </span>
              </div>
              <p className="flex items-center gap-2 text-sm text-slate-700">
                {conexao?.conectado ? (
                  <Wifi className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <WifiOff className="h-4 w-4 shrink-0 text-amber-600" />
                )}
                {conexao?.numero || "Nenhum número conectado"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Última conexão:{" "}
                {conexao?.ultimaConexao ? new Date(conexao.ultimaConexao).toLocaleString("pt-BR") : "—"}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => void gerarQr()} disabled={processando}>
                  <QrCode className="h-3.5 w-3.5" />
                  Gerar QR Code
                </Button>
                {conexao?.conectado ? (
                  <Button size="sm" variant="outline" onClick={() => void desconectar()} disabled={processando}>
                    Desconectar
                  </Button>
                ) : null}
              </div>
            </div>
            {!conexao?.conectado && qrImagem ? (
              <img src={qrImagem} alt="QR Code WhatsApp" className="h-[120px] w-[120px] shrink-0 rounded-lg border border-slate-200" />
            ) : null}
          </div>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-7 xl:grid-cols-4">
          <DisparosMetricCard titulo="Campanhas" valor={metricas?.totalCampanhas ?? 0} subtitulo="Total de campanhas" icon={Send} tom="indigo" />
          <DisparosMetricCard titulo="Enviadas hoje" valor={metricas?.enviadasHoje ?? 0} subtitulo="Mensagens enviadas" icon={MessageCircle} tom="emerald" />
          <DisparosMetricCard titulo="Pendentes" valor={metricas?.pendentes ?? 0} subtitulo="Aguardando envio" icon={Play} tom="amber" />
          <DisparosMetricCard titulo="Falhas" valor={metricas?.falhas ?? 0} subtitulo="Não entregues" icon={AlertTriangle} tom="rose" />
        </div>
      </div>

      {/* Campanhas + Progresso lado a lado */}
      <div className="grid gap-4 xl:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm xl:col-span-7 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">Campanhas recentes</h2>
            <div className="flex gap-2">
              <a href="/api/disparos-whatsapp/historico?formato=xlsx">
                <Button variant="ghost" size="sm">
                  <Download className="h-3.5 w-3.5" />
                  Exportar
                </Button>
              </a>
              <Link href="/app/disparos-whatsapp/historico">
                <Button variant="ghost" size="sm">
                  Ver todas
                </Button>
              </Link>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table headers={["Nome", "Data", "Contatos", "Enviadas", "Pendentes", "Falhas", "Status", "Ações"]}>
              {campanhas.slice(0, 8).map((c) => (
                <tr
                  key={c.id}
                  className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 ${
                    campanhaAtiva?.id === c.id ? "bg-indigo-50/50" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{c.nome}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                    {new Date(c.createdAt).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-sm">{c.totalContatos}</td>
                  <td className="px-4 py-3 text-sm text-emerald-700">{c.enviadas}</td>
                  <td className="px-4 py-3 text-sm text-amber-700">{c.pendentes}</td>
                  <td className="px-4 py-3 text-sm text-red-600">{c.falhas}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadge(c.status)}`}>
                      {labelStatus(c.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-0.5">
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => void abrirCampanha(c)}>
                        Abrir
                      </Button>
                      {(c.status === "rascunho" || c.status === "agendada") && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => void acaoCampanha(c.id, "iniciar")} title="Iniciar">
                          <Play className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => void acaoCampanha(c.id, "duplicar")} title="Duplicar">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setExcluirId(c.id)} title="Excluir">
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          </div>
          {!campanhas.length && (
            <p className="p-10 text-center text-sm text-slate-500">Nenhuma campanha ainda. Clique em Nova Campanha.</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-5 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">Progresso do disparo</h2>
            {emDisparo && campanhaAtiva.status === "enviando" ? (
              <Button size="sm" variant="outline" onClick={() => void acaoCampanha(campanhaAtiva.id, "pausar")}>
                <Pause className="h-3.5 w-3.5" /> Pausar
              </Button>
            ) : emDisparo && campanhaAtiva.status === "pausada" ? (
              <Button size="sm" onClick={() => void acaoCampanha(campanhaAtiva.id, "continuar")}>
                <Play className="h-3.5 w-3.5" /> Continuar
              </Button>
            ) : null}
          </div>

          {emDisparo ? (
            <>
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                <ProgressoCircular percentual={progresso.percentual} />
                <div className="grid flex-1 grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Enviadas</p>
                    <p className="font-semibold text-emerald-700">{progresso.enviadas}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Pendentes</p>
                    <p className="font-semibold text-amber-700">{progresso.pendentes}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Falhas</p>
                    <p className="font-semibold text-red-600">{progresso.falhas}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Total</p>
                    <p className="font-semibold text-slate-800">{progresso.total}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-slate-800">
                <p>
                  Tempo restante: <strong className="text-slate-700">{formatarTempoRestante(progresso.tempoRestanteSegundos)}</strong>
                </p>
                <p>
                  Velocidade: <strong className="text-slate-700">{campanhaAtiva.intervaloSegundos}s</strong> por mensagem
                </p>
                <p className="truncate font-medium text-indigo-700">{campanhaAtiva.nome}</p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                  style={{ width: `${progresso.percentual}%` }}
                />
              </div>
              <Button
                size="sm"
                variant="danger"
                className="mt-4 w-full"
                onClick={() => {
                  if (window.confirm("Cancelar o disparo em andamento?")) {
                    void acaoCampanha(campanhaAtiva.id, "cancelar");
                  }
                }}
              >
                <X className="h-3.5 w-3.5" /> Cancelar disparo
              </Button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center text-sm text-slate-500">
              <RefreshCw className="mb-3 h-8 w-8 text-slate-300" />
              <p>Selecione uma campanha em andamento ou inicie um novo disparo.</p>
            </div>
          )}
        </div>
      </div>

      {/* Fila de envio */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100">
            Fila de envio
            {campanhaAtiva ? (
              <span className="ml-2 text-sm font-normal text-slate-500">— {campanhaAtiva.nome}</span>
            ) : null}
          </h2>
        </div>
        {fila.length > 0 ? (
          <Table headers={["", "Nome", "Telefone", "Status", "Horário", "Tentativas", "Erro"]}>
            {fila.map((item) => (
              <tr key={item.id} className="text-sm">
                <td className="px-4 py-2.5">{dotStatus(item.status)}</td>
                <td className="px-4 py-2.5 font-medium">{item.nome}</td>
                <td className="px-4 py-2.5 text-slate-600">{item.telefone}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${statusBadge(item.status)}`}>
                    {labelStatus(item.status)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">
                  {new Date(item.horario).toLocaleTimeString("pt-BR")}
                </td>
                <td className="px-4 py-2.5 text-center">{item.tentativas}</td>
                <td className="max-w-[180px] truncate px-4 py-2.5 text-xs text-red-600">{item.erro || "—"}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <p className="p-8 text-center text-sm text-slate-500">A fila aparece ao abrir ou iniciar uma campanha.</p>
        )}
      </div>

      <CampanhaWizardModal
        open={wizardAberto}
        onClose={() => setWizardAberto(false)}
        onSalvo={() => {
          setWizardAberto(false);
          toast("sucesso", "Campanha salva com sucesso.");
          void recarregar();
        }}
        conectado={Boolean(conexao?.conectado)}
      />

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

      <DisparosToast toasts={toasts} onRemover={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </div>
  );
}
