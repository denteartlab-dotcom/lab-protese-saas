"use client";

import { useCallback, useState } from "react";
import QRCode from "qrcode";
import { useEffect } from "react";
import {
  Badge,
  Button,
  StatCard,
  Table,
} from "@/components/ui";
import { ConfirmacaoExclusaoModal } from "@/components/ConfirmacaoExclusaoModal";
import { CampanhaWizardModal } from "@/components/disparos-whatsapp/CampanhaWizardModal";
import { DisparosToast, type ToastDisparo } from "@/components/disparos-whatsapp/DisparosToast";
import { useDisparosSocket } from "@/hooks/useDisparosSocket";
import {
  estimarDuracaoDisparo,
  formatarTempoRestante,
} from "@/lib/whatsapp-disparos/mensagem-variaveis";
import type { CampanhaPublica } from "@/lib/whatsapp-disparos/campanha-servidor";
import {
  AlertTriangle,
  Copy,
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
import Link from "next/link";
import { motion } from "framer-motion";

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
    falhou: "bg-red-100 text-red-800",
    enviado: "bg-emerald-100 text-emerald-800",
    aguardando: "bg-amber-100 text-amber-800",
    falhou_contato: "bg-red-100 text-red-800",
  };
  return map[status] || "bg-slate-100 text-slate-700";
}

function labelStatus(status: string) {
  const map: Record<string, string> = {
    rascunho: "Rascunho",
    agendada: "Agendada",
    enviando: "Enviando",
    pausada: "Pausada",
    concluida: "Finalizada",
    cancelada: "Cancelada",
    enviado: "Enviado",
    aguardando: "Aguardando",
    falhou: "Falhou",
    pausado: "Pausado",
  };
  return map[status] || status;
}

export function DisparosWhatsappConteudo({
  embedded = false,
  historicoHref = "/app/disparos-whatsapp/historico",
}: {
  embedded?: boolean;
  historicoHref?: string;
}) {
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
        const img = await QRCode.toDataURL(dash.conexao.qr, { width: 200, margin: 2 });
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
        const img = await QRCode.toDataURL(qr, { width: 200, margin: 2 });
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
        ].slice(0, 50);
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
        if (camp) setCampanhaAtiva(camp);
        const filaRes = await fetch(`/api/disparos-whatsapp/campanhas/${id}/contatos`);
        const filaData = (await filaRes.json()) as { contatos: ContatoFila[] };
        setFila(filaData.contatos || []);
      }
      if (acao === "cancelar") setCampanhaAtiva(null);
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
    const res = await fetch(`/api/disparos-whatsapp/campanhas/${c.id}/contatos`);
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
    }
  }

  if (carregando && !dashboard) {
    return (
      <div className="space-y-4 p-6">
        <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  const conexao = dashboard?.conexao;
  const metricas = dashboard?.metricas;

  return (
    <div className={embedded ? "space-y-6" : "space-y-6 pb-10"}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        {!embedded ? (
          <div>
            <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">Disparos WhatsApp</h1>
            <p className="mt-1 text-sm text-slate-500">Crie e gerencie campanhas de WhatsApp com envio automático.</p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Crie e gerencie campanhas de WhatsApp com envio automático pelo número do laboratório.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Link href={historicoHref}>
            <Button variant="outline" size="sm">
              <History className="h-4 w-4" />
              Histórico
            </Button>
          </Link>
          <Button onClick={() => setWizardAberto(true)}>
            <Plus className="h-4 w-4" />
            Nova Campanha
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:col-span-1"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium text-slate-800 dark:text-slate-100">Conexão WhatsApp</h2>
            <Badge className={conexao?.conectado ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>
              {conexao?.conectado ? "Conectado" : "Desconectado"}
            </Badge>
          </div>
          <div className="space-y-2 text-sm text-slate-600">
            <p className="flex items-center gap-2">
              {conexao?.conectado ? <Wifi className="h-4 w-4 text-emerald-600" /> : <WifiOff className="h-4 w-4 text-amber-600" />}
              {conexao?.numero || "Nenhum número conectado"}
            </p>
            <p className="text-xs text-slate-500">
              Última conexão:{" "}
              {conexao?.ultimaConexao
                ? new Date(conexao.ultimaConexao).toLocaleString("pt-BR")
                : "—"}
            </p>
          </div>
          {!conexao?.conectado && qrImagem ? (
            <img src={qrImagem} alt="QR Code" className="mx-auto mt-4 h-[180px] w-[180px] rounded-lg border" />
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => void gerarQr()} disabled={processando}>
              <QrCode className="h-4 w-4" />
              Gerar QR Code
            </Button>
            {conexao?.conectado ? (
              <Button size="sm" variant="ghost" onClick={() => void desconectar()} disabled={processando}>
                Desconectar
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => void recarregar()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2 xl:grid-cols-4">
          <StatCard title="Campanhas" value={String(metricas?.totalCampanhas ?? 0)} icon={Send} />
          <StatCard title="Enviadas hoje" value={String(metricas?.enviadasHoje ?? 0)} icon={MessageCircle} />
          <StatCard title="Pendentes" value={String(metricas?.pendentes ?? 0)} icon={Play} />
          <StatCard title="Falhas" value={String(metricas?.falhas ?? 0)} icon={AlertTriangle} />
        </div>
      </div>

      {campanhaAtiva && (campanhaAtiva.status === "enviando" || campanhaAtiva.status === "pausada") && progresso ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-5 dark:border-indigo-900 dark:bg-indigo-950/30"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-medium text-slate-800">Progresso — {campanhaAtiva.nome}</h3>
              <p className="text-xs text-slate-500">
                {progresso.percentual}% · Tempo restante ~{formatarTempoRestante(progresso.tempoRestanteSegundos)} ·{" "}
                {campanhaAtiva.intervaloSegundos}s por mensagem
              </p>
            </div>
            <div className="flex gap-2">
              {campanhaAtiva.status === "enviando" ? (
                <Button size="sm" variant="outline" onClick={() => void acaoCampanha(campanhaAtiva.id, "pausar")}>
                  <Pause className="h-4 w-4" /> Pausar
                </Button>
              ) : (
                <Button size="sm" onClick={() => void acaoCampanha(campanhaAtiva.id, "continuar")}>
                  <Play className="h-4 w-4" /> Continuar
                </Button>
              )}
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  if (window.confirm("Cancelar o disparo em andamento?")) {
                    void acaoCampanha(campanhaAtiva.id, "cancelar");
                  }
                }}
              >
                <X className="h-4 w-4" /> Cancelar
              </Button>
            </div>
          </div>
          <div className="mb-4 h-3 overflow-hidden rounded-full bg-white dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${progresso.percentual}%` }}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <StatCard title="Enviadas" value={String(progresso.enviadas)} icon={CheckIcon} className="!p-3" />
            <StatCard title="Pendentes" value={String(progresso.pendentes)} icon={Play} className="!p-3" />
            <StatCard title="Falhas" value={String(progresso.falhas)} icon={AlertTriangle} className="!p-3" />
            <StatCard
              title="Tempo restante"
              value={formatarTempoRestante(progresso.tempoRestanteSegundos)}
              icon={RefreshCw}
              className="!p-3"
            />
          </div>
        </motion.div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 className="font-medium text-slate-800 dark:text-slate-100">Campanhas recentes</h2>
        </div>
        <Table headers={["Nome", "Data", "Contatos", "Enviadas", "Pendentes", "Falhas", "Status", "Ações"]}>
          {campanhas.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
              <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{c.nome}</td>
              <td className="px-4 py-3 text-slate-600">{new Date(c.createdAt).toLocaleString("pt-BR")}</td>
              <td className="px-4 py-3">{c.totalContatos}</td>
              <td className="px-4 py-3 text-emerald-700">{c.enviadas}</td>
              <td className="px-4 py-3 text-amber-700">{c.pendentes}</td>
              <td className="px-4 py-3 text-red-700">{c.falhas}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(c.status)}`}>
                  {labelStatus(c.status)}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="ghost" onClick={() => void abrirCampanha(c)} title="Abrir">
                    Abrir
                  </Button>
                  {c.status === "rascunho" || c.status === "agendada" ? (
                    <Button size="sm" variant="ghost" onClick={() => void acaoCampanha(c.id, "iniciar")} title="Iniciar">
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => void acaoCampanha(c.id, "duplicar")} title="Duplicar">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setExcluirId(c.id)} title="Excluir">
                    <Trash2 className="h-3.5 w-3.5 text-red-600" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
        {!campanhas.length ? (
          <p className="p-8 text-center text-sm text-slate-500">Nenhuma campanha ainda. Crie a primeira campanha.</p>
        ) : null}
      </div>

      {fila.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <h2 className="font-medium text-slate-800">Fila de envio {campanhaAtiva ? `— ${campanhaAtiva.nome}` : ""}</h2>
          </div>
          <Table headers={["Nome", "Telefone", "Status", "Horário", "Tentativas", "Erro"]}>
            {fila.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-2">{item.nome}</td>
                <td className="px-4 py-2">{item.telefone}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusBadge(item.status)}`}>
                    {labelStatus(item.status)}
                  </span>
                </td>
                <td className="px-4 py-2 text-xs">{new Date(item.horario).toLocaleTimeString("pt-BR")}</td>
                <td className="px-4 py-2">{item.tentativas}</td>
                <td className="max-w-[200px] truncate px-4 py-2 text-xs text-red-600">{item.erro || "—"}</td>
              </tr>
            ))}
          </Table>
        </div>
      ) : null}

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

function CheckIcon({ className }: { className?: string }) {
  return <MessageCircle className={className} />;
}
