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
import { apiFetch } from "@/lib/fetch-client";
import Link from "next/link";
import { PainelAnotacoesDashboard } from "@/components/dashboard/PainelAnotacoesDashboard";
import { DashboardInicioSkeleton, DashboardWidgetSkeleton } from "@/components/dashboard/DashboardInicioSkeleton";
import { PainelServicosDashboard } from "@/components/dashboard/PainelServicosDashboard";
import { PdfViewerModal } from "@/components/dashboard/PdfViewerModal";
import { PainelUrgenciasClienteDashboard } from "@/components/dashboard/PainelUrgenciasClienteDashboard";
import type { UrgenteClienteDashboardItem } from "@/lib/urgencia-cliente-util";
import {
  agruparTrabalhosPainelServicos,
  rotuloFimPeriodoVencendo,
} from "@/lib/painel-servicos-dashboard";
import {
  gerarPdfServicosAtrasados,
  gerarPdfServicosVencendo,
} from "@/lib/pdf-servicos-vencendo";
import { useLabConfigClient } from "@/lib/use-lab-config-client";
import { usePermissoesApp } from "@/components/PermissoesAppProvider";
import { permissaoIdPorHref } from "@/lib/usuarios-menu-permissoes";

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
  estoqueResumo?: { baixo: number; zerado: number };
  urgentesCliente?: UrgenteClienteDashboardItem[];
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

const uploadsResumoVazio: UploadsResumoUi = {
  bytesUsados: 0,
  bytesLivres: 20 * 1024 ** 3,
  limiteGb: 20,
  percentualUsado: 0,
  percentualLivre: 100,
};

const estoqueResumoVazio = { baixo: 0, zerado: 0 };

type TrabalhoPainel = {
  id: string;
  numeroOs: number;
  grupoOsId?: string | null;
  segmentoFaturamento?: string | null;
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
  const { lab } = useLabConfigClient();
type DashboardSecundario = Pick<
  Dashboard,
  "aniversariantesMes" | "clientesSemServico" | "uploadsResumo"
>;

  const [data, setData] = useState<Dashboard | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [carregandoSecundario, setCarregandoSecundario] = useState(false);
  const [clientePronto, setClientePronto] = useState(false);
  const [error, setError] = useState("");
  const [prazoVencendo, setPrazoVencendo] = useState<TipoPrazoProducao>("lab");
  const [periodoVencendo, setPeriodoVencendo] = useState("hoje");
  const [prazoAtrasados, setPrazoAtrasados] = useState<TipoPrazoProducao>("lab");
  const opcoesDiaVencendo = useMemo(() => opcoesPeriodoVencendo(5), []);
  const [painelExpandido, setPainelExpandido] = useState<"vencendo" | "atrasados" | null>(null);
  const [mesFiltro, setMesFiltro] = useState(new Date().getMonth());
  const [anoFiltro, setAnoFiltro] = useState(new Date().getFullYear());
  const [diasSemServico, setDiasSemServico] = useState(15);
  const [pdfVencendoUrl, setPdfVencendoUrl] = useState<string | null>(null);
  const [pdfAtrasadosUrl, setPdfAtrasadosUrl] = useState<string | null>(null);
  const { acessoTotal, permissoesModulos } = usePermissoesApp();
  const dataRef = useRef<Dashboard | null>(data);
  const diasSemServicoAnterior = useRef(diasSemServico);
  dataRef.current = data;

  const paramsBase = useCallback(
    () =>
      new URLSearchParams({
        mes: String(mesFiltro),
        ano: String(anoFiltro),
        diasSemServico: String(diasSemServico),
        clientesSemServicoLimite: "0",
        mesAniversario: String(new Date().getMonth()),
      }),
    [mesFiltro, anoFiltro, diasSemServico]
  );

  const carregarDashboardSecundario = useCallback(() => {
    const params = paramsBase();
    params.set("escopo", "secundario");
    setCarregandoSecundario(true);
    return apiFetch<DashboardSecundario>(`/api/dashboard?${params}`)
      .then((secundario) => {
        setData((atual) => (atual ? { ...atual, ...secundario } : ({ ...secundario } as Dashboard)));
      })
      .catch((e) => setError(e.message))
      .finally(() => setCarregandoSecundario(false));
  }, [paramsBase]);

  const carregarDashboard = useCallback(() => {
    const params = paramsBase();
    params.set("escopo", "core");
    if (!dataRef.current) setCarregando(true);
    return apiFetch<Dashboard>(`/api/dashboard?${params}`)
      .then((dash) => {
        setData((atual) => ({ ...atual, ...dash }));
        void carregarDashboardSecundario();
      })
      .catch((e) => setError(e.message))
      .finally(() => setCarregando(false));
  }, [paramsBase, carregarDashboardSecundario]);

  useEffect(() => {
    function atualizarEstoque() {
      void carregarDashboard();
    }
    function atualizarUploads() {
      void carregarDashboardSecundario();
    }
    window.addEventListener(PRODUTOS_ESTOQUE_EVENT, atualizarEstoque);
    window.addEventListener(UPLOADS_ATUALIZADO_EVENT, atualizarUploads);
    return () => {
      window.removeEventListener(PRODUTOS_ESTOQUE_EVENT, atualizarEstoque);
      window.removeEventListener(UPLOADS_ATUALIZADO_EVENT, atualizarUploads);
    };
  }, [carregarDashboard, carregarDashboardSecundario]);

  useEffect(() => {
    if (!clientePronto || !data) return;
    if (diasSemServicoAnterior.current === diasSemServico) return;
    diasSemServicoAnterior.current = diasSemServico;
    void carregarDashboardSecundario();
  }, [clientePronto, diasSemServico, data, carregarDashboardSecundario]);

  useEffect(() => {
    setClientePronto(true);
  }, []);

  useEffect(() => {
    if (!clientePronto) return;
    void carregarDashboard();
  }, [clientePronto, carregarDashboard]);

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
  const vencendoGrupos = useMemo(
    () => agruparTrabalhosPainelServicos(vencendoLista, prazoVencendo),
    [vencendoLista, prazoVencendo]
  );
  const atrasadosGrupos = useMemo(
    () => agruparTrabalhosPainelServicos(atrasadosLista, prazoAtrasados),
    [atrasadosLista, prazoAtrasados]
  );

  async function abrirPdfServicosPainel(
    gerar: () => Promise<Blob>,
    atualizarUrl: (url: string) => void,
    urlAtual: string | null
  ) {
    try {
      const blob = await gerar();
      if (!blob || blob.size === 0) {
        window.alert("Não foi possível gerar o PDF. Tente novamente.");
        return;
      }
      const url = URL.createObjectURL(blob);
      if (urlAtual) URL.revokeObjectURL(urlAtual);
      atualizarUrl(url);
    } catch {
      window.alert("Não foi possível gerar o PDF. Tente novamente.");
    }
  }

  function imprimirServicosVencendo() {
    void abrirPdfServicosPainel(
      () =>
        gerarPdfServicosVencendo({
          lab,
          grupos: vencendoGrupos,
          tituloPeriodo: rotuloFimPeriodoVencendo(periodoVencendo),
        }),
      setPdfVencendoUrl,
      pdfVencendoUrl
    );
  }

  function fecharPdfVencendo() {
    if (pdfVencendoUrl) URL.revokeObjectURL(pdfVencendoUrl);
    setPdfVencendoUrl(null);
  }

  function imprimirServicosAtrasados() {
    void abrirPdfServicosPainel(
      () =>
        gerarPdfServicosAtrasados({
          lab,
          grupos: atrasadosGrupos,
        }),
      setPdfAtrasadosUrl,
      pdfAtrasadosUrl
    );
  }

  function fecharPdfAtrasados() {
    if (pdfAtrasadosUrl) URL.revokeObjectURL(pdfAtrasadosUrl);
    setPdfAtrasadosUrl(null);
  }

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
  const vencendo = vencendoGrupos.length;
  const atrasados = atrasadosGrupos.length;
  const producaoResumo = dashboard.producaoResumo ?? resumoProducaoVazio;
  const financeiroResumo = dashboard.financeiroResumo ?? resumoFinanceiroVazio;
  const podeVer = (href: string) => {
    if (acessoTotal) return true;
    const id = permissaoIdPorHref(href);
    return Boolean(permissoesModulos?.[id]?.ver);
  };
  const podeFinanceiro =
    podeVer("/app/financeiro?tipo=receita") ||
    podeVer("/app/financeiro?tipo=despesa") ||
    podeVer("/app/financeiro?aba=plano-de-contas") ||
    podeVer("/app/financeiro?aba=conta-bancaria");
  const podeClientes = podeVer("/app/clientes");

  return (
    <div className="space-y-4 text-[13px] text-slate-700">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span>{t("dashboard.home")}</span>
        <span>/</span>
        <span className="font-medium text-slate-700">{t("dashboard.inicio")}</span>
      </div>

      <PainelUrgenciasClienteDashboard
        titulo={t("dashboard.urgentesCliente")}
        lista={dashboard.urgentesCliente ?? []}
        labelVisualizar={t("dashboard.visualizar")}
      />

      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <PainelServicosDashboard
          titulo={t("dashboard.servicosVencendo")}
          valor={vencendo}
          tom="warning"
          painelControle="vencendo"
          grupos={vencendoGrupos}
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
          onImprimir={() => void imprimirServicosVencendo()}
          labelVisualizar={t("dashboard.visualizar")}
          labelImprimir={t("dashboard.imprimir")}
        />
        <PainelServicosDashboard
          titulo={t("dashboard.servicosAtrasados")}
          valor={atrasados}
          tom="danger"
          painelControle="atrasados"
          grupos={atrasadosGrupos}
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
          onImprimir={() => void imprimirServicosAtrasados()}
          labelVisualizar={t("dashboard.visualizar")}
          labelImprimir={t("dashboard.imprimir")}
        />
        <PainelEstoque
          titulo={t("dashboard.estoque")}
          baixo={dashboard.estoqueResumo?.baixo ?? estoqueResumoVazio.baixo}
          zerado={dashboard.estoqueResumo?.zerado ?? estoqueResumoVazio.zerado}
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

        {podeFinanceiro ? (
          <PainelFinanceiroDashboard
            titulo={t("dashboard.financeiro")}
            resumo={financeiroResumo}
            mes={mesFiltro}
            ano={anoFiltro}
            onMesChange={setMesFiltro}
            onAnoChange={setAnoFiltro}
          />
        ) : null}

        <PainelAnotacoesDashboard titulo="Anotações" locale={locale} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {podeClientes ? (
          carregandoSecundario && !dashboard.aniversariantesMes ? (
            <DashboardWidgetSkeleton />
          ) : (
            <PainelAniversariantesDashboard
              titulo={`${t("dashboard.aniversariantes")} 🎉`}
              lista={dashboard.aniversariantesMes ?? []}
              mes={new Date().getMonth()}
            />
          )
        ) : null}

        {podeClientes ? (
          carregandoSecundario && !dashboard.clientesSemServico ? (
            <DashboardWidgetSkeleton />
          ) : (
            <PainelClientesServicosDashboard
              titulo="Clientes - Serviços"
              lista={dashboard.clientesSemServico ?? []}
              diasMinimos={diasSemServico}
              onDiasChange={setDiasSemServico}
              carregarListaImpressao={async () => {
                const params = paramsBase();
                params.set("escopo", "secundario");
                const dash = await apiFetch<DashboardSecundario>(`/api/dashboard?${params}`);
                return dash.clientesSemServico ?? [];
              }}
            />
          )
        ) : null}

        {carregandoSecundario && !dashboard.uploadsResumo ? (
          <DashboardWidgetSkeleton />
        ) : (
          <PainelUploadsDashboard
            titulo="Uploads"
            resumo={dashboard.uploadsResumo ?? uploadsResumoVazio}
            onResumoAtualizado={() => void carregarDashboardSecundario()}
          />
        )}
      </div>

      {pdfVencendoUrl ? (
        <PdfViewerModal
          titulo={`Serviços vencendo até ${rotuloFimPeriodoVencendo(periodoVencendo)}`}
          pdfUrl={pdfVencendoUrl}
          nomeArquivo={`servicos-vencendo-${periodoVencendo}.pdf`}
          iframeTitle="PDF serviços vencendo"
          onFechar={fecharPdfVencendo}
        />
      ) : null}

      {pdfAtrasadosUrl ? (
        <PdfViewerModal
          titulo={`Serviços Atrasados (${atrasadosGrupos.length})`}
          pdfUrl={pdfAtrasadosUrl}
          nomeArquivo="servicos-atrasados.pdf"
          iframeTitle="PDF serviços atrasados"
          onFechar={fecharPdfAtrasados}
        />
      ) : null}
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
        <IndicadorEstoque
          valor={baixo}
          tom="amber"
          href="/app/produtos?estoque=minimo"
          label={labelBaixo}
        />
        <IndicadorEstoque
          valor={zerado}
          tom="rose"
          href="/app/produtos?estoque=zero"
          label={labelZerado}
        />
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
  const circle =
    tom === "amber"
      ? "bg-orange-100 text-orange-600 border border-orange-200"
      : "bg-red-50 text-red-500 border border-red-200";
  const link = tom === "amber" ? "text-orange-600" : "text-red-500";
  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${circle}`}
      >
        {valor}
      </span>
      <div className="text-center">
        <Link
          href={href}
          className={`text-[10px] font-medium underline-offset-2 hover:underline ${link}`}
        >
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
