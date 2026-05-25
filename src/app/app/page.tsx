"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PainelAniversariantesDashboard } from "@/components/dashboard/PainelAniversariantesDashboard";
import { PainelClientesServicosDashboard } from "@/components/dashboard/PainelClientesServicosDashboard";
import {
  PainelUploadsDashboard,
  type UploadsResumoUi,
} from "@/components/dashboard/PainelUploadsDashboard";
import { PainelFinanceiroDashboard } from "@/components/dashboard/PainelFinanceiroDashboard";
import { PainelProducaoDashboard } from "@/components/dashboard/PainelProducaoDashboard";
import { useI18n } from "@/components/i18n-provider";
import type { ResumoFinanceiroDashboard } from "@/lib/dashboard-financeiro";
import type {
  AniversarianteMesItem,
  ClienteSemServicoItem,
} from "@/lib/dashboard-clientes-servico";
import type { ResumoProducaoDashboard } from "@/lib/dashboard-producao";
import {
  filtrarTrabalhosAtrasados,
  filtrarTrabalhosVencendoPeriodo,
  opcoesPeriodoVencendo,
  type TipoPrazoProducao,
} from "@/lib/controle-producao-prazos";
import { PRODUTOS_ESTOQUE_EVENT } from "@/lib/estoque";
import { UPLOADS_ATUALIZADO_EVENT } from "@/lib/uploads-armazenamento";
import { carregarResumoEstoqueDashboard } from "@/lib/resumo-estoque-dashboard";
import { apiFetch } from "@/lib/fetch-client";
import Link from "next/link";
import { PainelAnotacoesDashboard } from "@/components/dashboard/PainelAnotacoesDashboard";
import { DashboardInicioSkeleton } from "@/components/dashboard/DashboardInicioSkeleton";
import { PainelServicosDashboard } from "@/components/dashboard/PainelServicosDashboard";
import { hrefControlePainel } from "@/lib/notificacao-links";

const DASHBOARD_CACHE_KEY = "labProteseDashboardInicio";

function lerCacheDashboard(): Dashboard | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DASHBOARD_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Dashboard;
  } catch {
    return null;
  }
}

function gravarCacheDashboard(payload: Dashboard) {
  try {
    sessionStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* quota ou modo privado */
  }
}

type Dashboard = {
  totalClientes: number;
  totalPacientes: number;
  trabalhosAtivos: number;
  faturamentoMes: number;
  despesasMes: number;
  saldoMes: number;
  trabalhosRecentes: Array<{
    id: string;
    numeroOs: number;
    tipoProtese: string;
    status: string;
    dataEntrada: string;
    cliente: { nome: string };
    paciente: { nome: string };
  }>;
  servicosAtrasados?: TrabalhoPainel[];
  servicosVencendo?: TrabalhoPainel[];
  trabalhosControle?: TrabalhoPainel[];
  producaoResumo?: ResumoProducaoDashboard;
  financeiroResumo?: ResumoFinanceiroDashboard;
  aniversariantesMes?: AniversarianteMesItem[];
  clientesSemServico?: ClienteSemServicoItem[];
  uploadsResumo?: UploadsResumoUi;
};

const resumoProducaoVazio: ResumoProducaoDashboard = {
  porStatus: {
    finalizado: 0,
    saiu_entrega: 0,
    entregue: 0,
    producao: 0,
    prova: 0,
    pendente: 0,
    pedido: 0,
  },
  concluido: 0,
  pendente: 0,
  percentual: 0,
  total: 0,
};

const resumoFinanceiroVazio: ResumoFinanceiroDashboard = {
  receitasAReceber: 0,
  receitasInadimplencia: 0,
  despesasAPagar: 0,
  despesasVencidas: 0,
};

type TrabalhoPainel = {
  id: string;
  numeroOs: number;
  tipoProtese: string;
  status: string;
  dataEntrada: string;
  dataPrevista: string | null;
  escala?: string | null;
  instrucoes?: string | null;
  cliente: { nome: string };
  paciente: { nome: string };
};

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const [data, setData] = useState<Dashboard | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [clientePronto, setClientePronto] = useState(false);
  const [error, setError] = useState("");
  const [prazoVencendo, setPrazoVencendo] = useState<TipoPrazoProducao>("lab");
  const [periodoVencendo, setPeriodoVencendo] = useState("hoje");
  const [prazoAtrasados, setPrazoAtrasados] = useState<TipoPrazoProducao>("lab");
  const opcoesDiaVencendo = useMemo(() => opcoesPeriodoVencendo(5), []);
  const [estoqueResumo, setEstoqueResumo] = useState({ baixo: 0, zerado: 0 });
  const [painelExpandido, setPainelExpandido] = useState<"vencendo" | "atrasados" | null>(null);
  const [mesFiltro, setMesFiltro] = useState(new Date().getMonth());
  const [anoFiltro, setAnoFiltro] = useState(new Date().getFullYear());
  const [diasSemServico, setDiasSemServico] = useState(15);
  const [uploadsResumo, setUploadsResumo] = useState<UploadsResumoUi | null>(null);
  const dataRef = useRef<Dashboard | null>(data);
  dataRef.current = data;

  const carregarDashboard = useCallback(() => {
    const params = new URLSearchParams({
      mes: String(mesFiltro),
      ano: String(anoFiltro),
      diasSemServico: String(diasSemServico),
      mesAniversario: String(new Date().getMonth()),
    });
    if (!dataRef.current) setCarregando(true);
    return apiFetch<Dashboard>(`/api/dashboard?${params}`)
      .then((dash) => {
        setData(dash);
        gravarCacheDashboard(dash);
        if (dash.uploadsResumo) setUploadsResumo(dash.uploadsResumo);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCarregando(false));
  }, [mesFiltro, anoFiltro, diasSemServico]);

  const recarregarUploads = useCallback(async () => {
    try {
      const res = await fetch("/api/uploads", { cache: "no-store" });
      if (res.ok) setUploadsResumo((await res.json()) as UploadsResumoUi);
    } catch {
      /* mantém último valor */
    }
  }, []);

  useEffect(() => {
    const cached = lerCacheDashboard();
    if (cached) {
      setData(cached);
      setCarregando(false);
      if (cached.uploadsResumo) setUploadsResumo(cached.uploadsResumo);
    }
    setClientePronto(true);
  }, []);

  useEffect(() => {
    if (!clientePronto) return;
    void carregarDashboard();
    void recarregarUploads();
  }, [clientePronto, carregarDashboard, recarregarUploads]);

  useEffect(() => {
    function atualizarEstoque() {
      void carregarResumoEstoqueDashboard().then(setEstoqueResumo);
    }
    atualizarEstoque();
    window.addEventListener(PRODUTOS_ESTOQUE_EVENT, atualizarEstoque);
    window.addEventListener(UPLOADS_ATUALIZADO_EVENT, recarregarUploads);
    return () => {
      window.removeEventListener(PRODUTOS_ESTOQUE_EVENT, atualizarEstoque);
      window.removeEventListener(UPLOADS_ATUALIZADO_EVENT, recarregarUploads);
    };
  }, [recarregarUploads]);

  const trabalhosControle =
    data?.trabalhosControle || data?.servicosAtrasados || [];
  const vencendoLista = useMemo(
    () => filtrarTrabalhosVencendoPeriodo(trabalhosControle, prazoVencendo, periodoVencendo),
    [trabalhosControle, prazoVencendo, periodoVencendo]
  );
  const atrasadosLista = useMemo(
    () => filtrarTrabalhosAtrasados(trabalhosControle, prazoAtrasados),
    [trabalhosControle, prazoAtrasados]
  );

  if (carregando && !data) {
    return <DashboardInicioSkeleton />;
  }

  if (!data) {
    return error ? (
      <p className="text-red-600">{error}</p>
    ) : (
      <DashboardInicioSkeleton />
    );
  }

  const dashboard = data;
  const vencendo = vencendoLista.length;
  const atrasados = atrasadosLista.length;
  const producaoResumo = dashboard.producaoResumo ?? resumoProducaoVazio;
  const financeiroResumo = dashboard.financeiroResumo ?? resumoFinanceiroVazio;

  return (
    <div className="space-y-4 text-[13px] text-slate-700">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span>{t("dashboard.home")}</span>
        <span>/</span>
        <span className="font-medium text-slate-700">{t("dashboard.inicio")}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <PainelServicosDashboard
          titulo={t("dashboard.servicosVencendo")}
          valor={vencendo}
          tom="warning"
          trabalhos={vencendoLista}
          tipoPrazo={prazoVencendo}
          expandido={painelExpandido === "vencendo"}
          onToggleExpandir={() =>
            setPainelExpandido((atual) => (atual === "vencendo" ? null : "vencendo"))
          }
          filtros={
            <>
              <FiltroSelect
                value={prazoVencendo}
                onChange={(v) => setPrazoVencendo(v as TipoPrazoProducao)}
                tom="warning"
                opcoes={[
                  { value: "lab", label: "Prazo Lab" },
                  { value: "dentista", label: "Prazo Dentista" },
                ]}
              />
              <FiltroSelect
                value={periodoVencendo}
                onChange={setPeriodoVencendo}
                tom="warning"
                opcoes={opcoesDiaVencendo}
              />
            </>
          }
          linkImprimir={hrefControlePainel("vencendo", {
            prazo: prazoVencendo,
            dia: periodoVencendo,
            imprimir: true,
          })}
          labelVisualizar={t("dashboard.visualizar")}
          labelImprimir={t("dashboard.imprimir")}
        />
        <PainelServicosDashboard
          titulo={t("dashboard.servicosAtrasados")}
          valor={atrasados}
          tom="danger"
          trabalhos={atrasadosLista}
          tipoPrazo={prazoAtrasados}
          expandido={painelExpandido === "atrasados"}
          onToggleExpandir={() =>
            setPainelExpandido((atual) => (atual === "atrasados" ? null : "atrasados"))
          }
          filtros={
            <FiltroSelect
              value={prazoAtrasados}
              onChange={(v) => setPrazoAtrasados(v as TipoPrazoProducao)}
              tom="neutral"
              opcoes={[
                { value: "lab", label: "Prazo Lab" },
                { value: "dentista", label: "Prazo Dentista" },
              ]}
            />
          }
          linkImprimir={hrefControlePainel("atrasados", {
            prazo: prazoAtrasados,
            imprimir: true,
          })}
          labelVisualizar={t("dashboard.visualizar")}
          labelImprimir={t("dashboard.imprimir")}
        />
        <PainelEstoque
          titulo={t("dashboard.estoque")}
          baixo={estoqueResumo.baixo}
          zerado={estoqueResumo.zerado}
          labelBaixo={t("dashboard.estoqueBaixo")}
          labelZerado={t("dashboard.estoqueZerado")}
          labelOrcamento={t("dashboard.solicitarOrcamento")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <PainelProducaoDashboard
          titulo={t("dashboard.producao")}
          resumo={producaoResumo}
          mes={mesFiltro}
          ano={anoFiltro}
          onMesChange={setMesFiltro}
          onAnoChange={setAnoFiltro}
          labels={{
            concluido: t("dashboard.concluido"),
            pendente: t("dashboard.pendente"),
            finalizado: t("dashboard.finalizado"),
            saiuEntrega: "Saiu p/ Entrega",
            entregue: t("dashboard.entregue"),
            producao: t("dashboard.producao"),
            emProva: t("dashboard.emProva"),
            pendenteStatus: "Pendente",
            pedido: "Pedido",
          }}
        />

        <PainelFinanceiroDashboard
          titulo={t("dashboard.financeiro")}
          resumo={financeiroResumo}
          mes={mesFiltro}
          ano={anoFiltro}
          onMesChange={setMesFiltro}
          onAnoChange={setAnoFiltro}
        />

        <PainelAnotacoesDashboard titulo="Anotações" locale={locale} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <PainelAniversariantesDashboard
          titulo={`${t("dashboard.aniversariantes")} 🎉`}
          lista={dashboard.aniversariantesMes ?? []}
          mes={new Date().getMonth()}
        />

        <PainelClientesServicosDashboard
          titulo="Clientes - Serviços"
          lista={dashboard.clientesSemServico ?? []}
          diasMinimos={diasSemServico}
          onDiasChange={setDiasSemServico}
        />

        <PainelUploadsDashboard
          titulo="Uploads"
          resumo={
            uploadsResumo ??
            dashboard.uploadsResumo ?? {
              bytesUsados: 0,
              bytesLivres: 80 * 1024 ** 3,
              limiteGb: 80,
              percentualUsado: 0,
              percentualLivre: 100,
            }
          }
          onResumoAtualizado={() => void recarregarUploads()}
        />
      </div>

    </div>
  );
}

function FiltroSelect({
  value,
  onChange,
  opcoes,
  tom,
}: {
  value: string;
  onChange: (value: string) => void;
  opcoes: Array<{ value: string; label: string }>;
  tom: "warning" | "neutral";
}) {
  const cls =
    tom === "warning"
      ? "border-amber-400 text-amber-700"
      : "border-slate-300 text-slate-600";
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-6 max-w-[96px] rounded border bg-white px-1.5 text-[10px] ${cls}`}
    >
      {opcoes.map((op) => (
        <option key={op.value} value={op.value}>
          {op.label}
        </option>
      ))}
    </select>
  );
}

function PainelEstoque({
  titulo,
  baixo,
  zerado,
  labelBaixo,
  labelZerado,
  labelOrcamento,
}: {
  titulo: string;
  baixo: number;
  zerado: number;
  labelBaixo: string;
  labelZerado: string;
  labelOrcamento: string;
}) {
  return (
    <div className="relative min-h-[118px] rounded border border-slate-200 bg-white px-4 pb-3 pt-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-slate-700">{titulo}</p>
        <Link
          href="/app/orcamentos"
          className="shrink-0 rounded border border-[#4a90d9] px-2 py-0.5 text-[10px] font-medium text-[#4a90d9] hover:bg-blue-50"
        >
          {labelOrcamento}
        </Link>
      </div>
      <div className="mt-4 flex items-start justify-around gap-4 px-2">
        <IndicadorEstoque valor={baixo} tom="amber" href="/app/produtos?estoque=minimo" label={labelBaixo} />
        <IndicadorEstoque valor={zerado} tom="rose" href="/app/produtos?estoque=zero" label={labelZerado} />
      </div>
    </div>
  );
}

function IndicadorEstoque({
  valor,
  tom,
  href,
  label,
}: {
  valor: number;
  tom: "amber" | "rose";
  href: string;
  label: string;
}) {
  const circle = tom === "amber" ? "bg-amber-500 text-white" : "bg-red-500 text-white";
  const link = tom === "amber" ? "text-amber-600" : "text-red-600";
  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${circle}`}
      >
        {valor}
      </span>
      <div className="text-center">
        <Link href={href} className={`text-[10px] font-medium underline-offset-2 hover:underline ${link}`}>
          ver
        </Link>
        <p className="mt-0.5 text-[11px] text-slate-600">{label}</p>
      </div>
    </div>
  );
}

function Panel({
  title,
  toolbar,
  children,
}: {
  title: string;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded border border-slate-200 bg-white shadow-sm">
      <div className="flex min-h-10 items-center justify-between border-b border-slate-100 px-4 py-2">
        <h2 className="text-sm font-medium text-slate-700">{title}</h2>
        {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function SmallButton({
  href,
  children,
  color = "primary",
}: {
  href: string;
  children: React.ReactNode;
  color?: "primary" | "warning" | "danger";
}) {
  const colors = {
    primary: "border-primary-200 bg-primary-50 text-primary-700",
    warning: "border-amber-200 bg-amber-100 text-amber-700",
    danger: "border-red-200 bg-red-500 text-white",
  };
  return (
    <Link
      href={href}
      className={`rounded border px-3 py-1 text-[11px] font-medium ${colors[color]}`}
    >
      {children}
    </Link>
  );
}

function TinySelect({ label }: { label: string }) {
  return (
    <button className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-500">
      {label} ▾
    </button>
  );
}
