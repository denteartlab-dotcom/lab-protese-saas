"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDown,
  DollarSign,
  Home,
  MoreVertical,
  Package,
  User,
} from "lucide-react";
import { PainelCarregando } from "@/components/ListaCarregando";
import { ModalCurvaAbcClientesDashboard } from "@/components/relatorios/ModalCurvaAbcClientesDashboard";
import { ModalCurvaAbcDetalheDashboard } from "@/components/relatorios/ModalCurvaAbcDetalheDashboard";
import { ModalInadimplentesDashboard } from "@/components/relatorios/ModalInadimplentesDashboard";
import type { SecaoCurvaAbc } from "@/lib/curva-abc-clientes";
import {
  carregarCadastrosProdutividadeColaboradores,
  dominioEixoYProdutividade,
  montarGraficoProdutividadeColaboradores,
} from "@/lib/dashboard-produtividade-colaboradores";
import {
  calcularProducaoPorSetor,
  calcularResumoProducaoMes,
  carregarCadastrosProducaoSetores,
  MESES_PRODUCAO_DASHBOARD,
  type FatiaProducaoSetor,
} from "@/lib/dashboard-producao-setores";
import {
  formatarMoedaResumo,
  MESES_DASHBOARD_GERENCIAL,
  montarCurvaAbcSecoesGrafico,
  secoesCurvaAbcClientesVazias,
  type DashboardGerencialPayload,
  type ItemCurvaAbcDashboard,
} from "@/lib/dashboard-gerencial";
import { FINANCEIRO_ATUALIZADO_EVENT } from "@/lib/financeiro-events";
import { cn } from "@/lib/utils";

const COR = {
  roxo: "#8e44ad",
  roxoClaro: "#9b59b6",
  azul: "#42a5f5",
  azulEscuro: "#3498db",
  verde: "#66bb6a",
  vermelho: "#ef5350",
  kpiRosa: "#e91e63",
  kpiTeal: "#1abc9c",
  kpiVerde: "#2ecc71",
  grid: "#e8e8e8",
  texto: "#9ca3af",
  /** Faixa A — roxo */
  abcA: "#9b59b6",
  /** Faixa B — azul */
  abcB: "#42a5f5",
  /** Faixa C — verde-água */
  abcC: "#26a69a",
} as const;

const CORES_ABC_PADRAO = [COR.abcA, COR.abcB, COR.abcC] as const;

const tickAxis = { fontSize: 11, fill: COR.texto };
const gridProps = { stroke: COR.grid, strokeDasharray: "3 3" };

function DonutProducao({
  fatias,
  total,
}: {
  fatias: { nome: string; valor: number; cor: string }[];
  total: number;
}) {
  const dados =
    fatias.length && total > 0
      ? fatias
      : [{ nome: "Sem dados", valor: 1, cor: "#e5e7eb" }];

  return (
    <div className="relative h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={dados}
            dataKey="valor"
            nameKey="nome"
            cx="50%"
            cy="50%"
            innerRadius={62}
            outerRadius={88}
            paddingAngle={fatias.length > 1 ? 2 : 0}
          >
            {dados.map((entry) => (
              <Cell key={entry.nome} fill={entry.cor} />
            ))}
          </Pie>
          <Tooltip content={<TooltipSimples />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            formatter={(value) => (
              <span className="text-[11px] text-[#6b7280]">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-8">
        <span className="text-[11px] text-[#9ca3af]">Total</span>
        <span className="text-[20px] font-medium text-[#374151]">{total}</span>
      </div>
    </div>
  );
}

const selectFiltroProducaoClass =
  "h-[30px] rounded-sm border border-[#d1d5db] bg-white px-2 text-[11px] text-[#374151] outline-none focus:border-[#4a90d9]";

function FiltrosMesAnoProducao({
  mes,
  ano,
  onMesChange,
  onAnoChange,
  anosOpcoes,
}: {
  mes: number;
  ano: number;
  onMesChange: (mes: number) => void;
  onAnoChange: (ano: number) => void;
  anosOpcoes: number[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <select
        className={selectFiltroProducaoClass}
        value={mes}
        onChange={(e) => onMesChange(Number(e.target.value))}
      >
        {MESES_PRODUCAO_DASHBOARD.map((nome, index) => (
          <option key={nome} value={index}>
            {nome}
          </option>
        ))}
      </select>
      <select
        className={cn(selectFiltroProducaoClass, "min-w-[72px]")}
        value={ano}
        onChange={(e) => onAnoChange(Number(e.target.value))}
      >
        {anosOpcoes.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
    </div>
  );
}

function CardProducaoPorSetor({
  mes,
  ano,
  onMesChange,
  onAnoChange,
  anosOpcoes,
  fatias,
  total,
}: {
  mes: number;
  ano: number;
  onMesChange: (mes: number) => void;
  onAnoChange: (ano: number) => void;
  anosOpcoes: number[];
  fatias: FatiaProducaoSetor[];
  total: number;
}) {
  return (
    <div className="overflow-hidden rounded-sm border border-[#e5e7eb] bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#f3f4f6] px-4 py-2.5">
        <h3 className="text-[13px] leading-snug text-[#374151]">
          Produção
          <br />
          por{" "}
          <span className="rounded-sm bg-[#4a90d9] px-1 py-0.5 text-white">Setor</span>
        </h3>
        <FiltrosMesAnoProducao
          mes={mes}
          ano={ano}
          onMesChange={onMesChange}
          onAnoChange={onAnoChange}
          anosOpcoes={anosOpcoes}
        />
      </div>
      <div className="p-4">
        <DonutProducao fatias={fatias} total={total} />
      </div>
    </div>
  );
}

function CardProdutividadeColaborador({
  mes,
  ano,
  onMesChange,
  onAnoChange,
  anosOpcoes,
  chartData,
  series,
  maxValor,
}: {
  mes: number;
  ano: number;
  onMesChange: (mes: number) => void;
  onAnoChange: (ano: number) => void;
  anosOpcoes: number[];
  chartData: ReturnType<typeof montarGraficoProdutividadeColaboradores>["chartData"];
  series: ReturnType<typeof montarGraficoProdutividadeColaboradores>["series"];
  maxValor: number;
}) {
  const { topo, ticks } = dominioEixoYProdutividade(maxValor);

  return (
    <div className="overflow-hidden rounded-sm border border-[#e5e7eb] bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#f3f4f6] px-4 py-2.5">
        <div>
          <h3 className="text-[13px] font-medium text-[#374151]">Produtividade Colaborador</h3>
          <p className="mt-0.5 text-[11px] text-[#9ca3af]">Produção</p>
        </div>
        <div className="flex items-start gap-2">
          <FiltrosMesAnoProducao
            mes={mes}
            ano={ano}
            onMesChange={onMesChange}
            onAnoChange={onAnoChange}
            anosOpcoes={anosOpcoes}
          />
          <button
            type="button"
            className="rounded p-1 text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#6b7280]"
            aria-label="Opções"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="p-4 pt-2">
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid stroke={COR.grid} strokeDasharray="3 3" />
              <XAxis dataKey="mes" tick={tickAxis} axisLine={false} tickLine={false} />
              <YAxis
                tick={tickAxis}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                domain={[0, topo]}
                ticks={ticks}
              />
              <Tooltip content={<TooltipSimples />} />
              {series.length > 1 && (
                <Legend
                  verticalAlign="bottom"
                  height={32}
                  iconType="circle"
                  formatter={(value) => (
                    <span className="text-[11px] text-[#6b7280]">{value}</span>
                  )}
                />
              )}
              {series.map((s) => (
                <Line
                  key={s.dataKey}
                  type="monotone"
                  dataKey={s.dataKey}
                  name={s.nome}
                  stroke={s.cor}
                  strokeWidth={2}
                  dot={{ r: 3, fill: s.cor }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function CardDashboard({
  titulo,
  children,
  className,
}: {
  titulo: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-sm border border-[#e5e7eb] bg-white shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-[#f3f4f6] px-4 py-2.5">
        <h3 className="text-[13px] font-medium text-[#374151]">{titulo}</h3>
        <button
          type="button"
          className="rounded p-1 text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#6b7280]"
          aria-label="Opções"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function ResumoMetrica({
  titulo,
  valor,
  icone,
  corFundo,
  corIcone,
  onClick,
}: {
  titulo: string;
  valor: string;
  icone: React.ReactNode;
  corFundo: string;
  corIcone: string;
  onClick?: () => void;
}) {
  const conteudo = (
    <>
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: corFundo, color: corIcone }}
      >
        {icone}
      </div>
      <div className="min-w-0">
        <p className="text-[20px] font-semibold leading-none text-[#374151]">{valor}</p>
        <p className="mt-1 text-[12px] text-[#9ca3af]">{titulo}</p>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-sm px-2 py-1 text-left transition-colors hover:bg-[#f9fafb]"
      >
        {conteudo}
      </button>
    );
  }

  return <div className="flex min-w-0 flex-1 items-center gap-3 px-2 py-1">{conteudo}</div>;
}

function CardCurvaAbc({
  subtitulo,
  legenda,
  children,
}: {
  subtitulo: string;
  legenda: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-sm border border-[#e5e7eb] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#f3f4f6] px-4 py-2.5">
        <h3 className="text-[13px] font-medium text-[#374151]">Curva ABC</h3>
        <button
          type="button"
          className="rounded p-1 text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#6b7280]"
          aria-label="Opções"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>
      <div className="px-4 pb-4 pt-3">
        <p className="mb-2 text-center text-[12px] font-medium text-[#374151]">
          {subtitulo}
        </p>
        <div className="mb-3 flex flex-wrap items-center justify-center gap-3">
          {CORES_ABC_PADRAO.map((cor, index) => (
            <span key={cor} className="flex items-center gap-1">
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: cor }}
              />
              <span className="text-[10px] text-[#9ca3af]">
                {(["A", "B", "C"] as const)[index]}
              </span>
            </span>
          ))}
          <span className="text-[11px] text-[#6b7280]">{legenda}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function GraficoCurvaAbc({
  dados,
  cores = CORES_ABC_PADRAO,
  onBarClick,
}: {
  dados: ItemCurvaAbcDashboard[];
  cores?: readonly string[];
  onBarClick?: (classe: "A" | "B" | "C") => void;
}) {
  const chartData = dados.map((d) => ({
    nome: d.rotulo,
    fracao: Number(d.acumulado.toFixed(2)),
    classe: d.classe,
  }));

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            stroke={COR.grid}
            strokeDasharray="3 3"
            horizontal
            vertical={false}
          />
          <XAxis
            type="number"
            domain={[0, 1]}
            ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]}
            tickFormatter={(v) => Number(v).toFixed(1)}
            tick={tickAxis}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="nome"
            width={76}
            tick={{ ...tickAxis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value) => [
              Number(value ?? 0).toFixed(2),
              "Participação",
            ]}
            labelFormatter={(label) => label}
            contentStyle={{
              fontSize: 12,
              borderRadius: 4,
              border: "1px solid #e5e7eb",
            }}
          />
          <Bar
            dataKey="fracao"
            radius={[0, 14, 14, 0]}
            maxBarSize={36}
            cursor={onBarClick ? "pointer" : undefined}
            onClick={(entry) => {
              const classe = (entry as { payload?: { classe?: "A" | "B" | "C" } })
                .payload?.classe;
              if (classe && onBarClick) onBarClick(classe);
            }}
          >
            {chartData.map((_, index) => (
              <Cell key={`abc-${index}`} fill={cores[index] ?? cores[0]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TooltipSimples({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-sm border border-[#e5e7eb] bg-white px-3 py-2 text-[11px] shadow-md">
      {label && <p className="mb-1 font-medium text-[#374151]">{label}</p>}
      {payload.map((item) => (
        <p key={item.name} style={{ color: item.color || "#374151" }}>
          {item.name}: {typeof item.value === "number" ? item.value : item.value}
        </p>
      ))}
    </div>
  );
}

const serieVazia = () =>
  MESES_DASHBOARD_GERENCIAL.map((mes) => ({ mes, valor: 0 }));

const contasReceberVazias = () =>
  MESES_DASHBOARD_GERENCIAL.map((mes) => ({
    mes,
    recebido: 0,
    aReceber: 0,
  }));

const receitasDespesasVazias = () =>
  MESES_DASHBOARD_GERENCIAL.map((mes) => ({
    mes,
    receitas: 0,
    despesas: 0,
  }));

function payloadVazio(ano: number): DashboardGerencialPayload {
  return {
    ano,
    resumo: {
      inadimplentes: 0,
      servicosAtrasados: 0,
      contasAPagar: 0,
      contasAReceber: 0,
    },
    inadimplentes: [],
    kpis: { receitaBruta: 0, margemLucro: 0, custoProducao: 0 },
    curvaAbc: {
      servicos: montarCurvaAbcSecoesGrafico(secoesCurvaAbcClientesVazias()),
      fornecedores: montarCurvaAbcSecoesGrafico(secoesCurvaAbcClientesVazias()),
      clientes: montarCurvaAbcSecoesGrafico(secoesCurvaAbcClientesVazias()),
    },
    curvaAbcServicosSecoes: secoesCurvaAbcClientesVazias(),
    curvaAbcFornecedoresSecoes: secoesCurvaAbcClientesVazias(),
    curvaAbcClientesSecoes: secoesCurvaAbcClientesVazias(),
    producao: { entregues: 0, atrasados: 0, total: 0 },
    trabalhosProducao: [],
    pedidos: serieVazia(),
    contasReceber: contasReceberVazias(),
    receitasDespesas: receitasDespesasVazias(),
  };
}

export function DashboardGerencialConteudo() {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [mesProducao, setMesProducao] = useState(new Date().getMonth());
  const [anoProducao, setAnoProducao] = useState(new Date().getFullYear());
  const [versaoCadastrosProducao, setVersaoCadastrosProducao] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [modalInadimplentes, setModalInadimplentes] = useState(false);
  const [secaoAbcServicos, setSecaoAbcServicos] = useState<SecaoCurvaAbc | null>(null);
  const [secaoAbcFornecedores, setSecaoAbcFornecedores] = useState<SecaoCurvaAbc | null>(null);
  const [secaoAbcClientes, setSecaoAbcClientes] = useState<SecaoCurvaAbc | null>(null);
  const [dados, setDados] = useState<DashboardGerencialPayload>(() =>
    payloadVazio(new Date().getFullYear())
  );

  const anosOpcoes = useMemo(() => {
    const atual = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => atual - 3 + i);
  }, []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch(`/api/relatorios/dashboard-gerencial?ano=${ano}`, {
        cache: "no-store",
      });
      const json = res.ok ? await res.json() : payloadVazio(ano);
      setDados(json);
    } catch {
      setDados(payloadVazio(ano));
    } finally {
      setCarregando(false);
    }
  }, [ano]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    const atualizar = () => void carregar();
    window.addEventListener(FINANCEIRO_ATUALIZADO_EVENT, atualizar);
    window.addEventListener("focus", atualizar);
    return () => {
      window.removeEventListener(FINANCEIRO_ATUALIZADO_EVENT, atualizar);
      window.removeEventListener("focus", atualizar);
    };
  }, [carregar]);

  useEffect(() => {
    setAnoProducao(ano);
  }, [ano]);

  useEffect(() => {
    const atualizar = () => setVersaoCadastrosProducao((v) => v + 1);
    window.addEventListener("focus", atualizar);
    window.addEventListener("storage", atualizar);
    return () => {
      window.removeEventListener("focus", atualizar);
      window.removeEventListener("storage", atualizar);
    };
  }, []);

  const cadastrosSetores = useMemo(() => {
    void versaoCadastrosProducao;
    return carregarCadastrosProducaoSetores();
  }, [versaoCadastrosProducao]);

  const cadastrosColaboradores = useMemo(() => {
    void versaoCadastrosProducao;
    return carregarCadastrosProdutividadeColaboradores();
  }, [versaoCadastrosProducao]);

  const resumoProducaoMes = useMemo(
    () =>
      calcularResumoProducaoMes(
        dados.trabalhosProducao ?? [],
        mesProducao,
        anoProducao
      ),
    [dados.trabalhosProducao, mesProducao, anoProducao]
  );

  const fatiasProducaoSetor = useMemo(
    () =>
      calcularProducaoPorSetor(
        dados.trabalhosProducao ?? [],
        mesProducao,
        anoProducao,
        cadastrosSetores.setores,
        cadastrosSetores.etapas
      ),
    [
      dados.trabalhosProducao,
      mesProducao,
      anoProducao,
      cadastrosSetores.setores,
      cadastrosSetores.etapas,
    ]
  );

  const dadosProducao = useMemo(() => {
    const { entregues, atrasados } = resumoProducaoMes;
    if (entregues + atrasados <= 0) {
      return [{ nome: "Sem dados", valor: 1, cor: "#e5e7eb" }];
    }
    return [
      { nome: "Entregues", valor: entregues, cor: COR.roxoClaro },
      { nome: "Atrasados", valor: atrasados, cor: COR.azul },
    ];
  }, [resumoProducaoMes]);

  const graficoProdutividadeColaborador = useMemo(
    () =>
      montarGraficoProdutividadeColaboradores(
        dados.trabalhosProducao ?? [],
        anoProducao,
        MESES_DASHBOARD_GERENCIAL,
        cadastrosColaboradores.cores,
        mesProducao
      ),
    [
      dados.trabalhosProducao,
      anoProducao,
      mesProducao,
      cadastrosColaboradores.cores,
    ]
  );

  const totalProducao = resumoProducaoMes.total;
  const totalProducaoSetor = fatiasProducaoSetor.reduce((s, f) => s + f.valor, 0);

  const abrirModalCurvaAbcServicos = useCallback(
    (classe: "A" | "B" | "C") => {
      const secao =
        dados.curvaAbcServicosSecoes.find((s) => s.classe === classe) ?? null;
      setSecaoAbcServicos(secao);
    },
    [dados.curvaAbcServicosSecoes]
  );

  const abrirModalCurvaAbcFornecedores = useCallback(
    (classe: "A" | "B" | "C") => {
      const secao =
        dados.curvaAbcFornecedoresSecoes.find((s) => s.classe === classe) ?? null;
      setSecaoAbcFornecedores(secao);
    },
    [dados.curvaAbcFornecedoresSecoes]
  );

  const abrirModalCurvaAbcClientes = useCallback(
    (classe: "A" | "B" | "C") => {
      const secao =
        dados.curvaAbcClientesSecoes.find((s) => s.classe === classe) ?? null;
      setSecaoAbcClientes(secao);
    },
    [dados.curvaAbcClientesSecoes]
  );

  return (
    <div className="dashboard-gerencial bg-[#f3f4f6] pb-8 pt-1 text-[12px] text-[#374151]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-normal leading-none text-[#6b7280]">Relatórios</h1>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            className="h-[34px] rounded-sm border border-[#d1d5db] bg-white px-3 text-[12px] text-[#374151] outline-none focus:border-[#4a90d9]"
          >
            {anosOpcoes.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1.5 text-[12px] text-[#9ca3af]">
            <Home className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[#d1d5db]">/</span>
            <span className="text-[#6b7280]">Dashboard</span>
          </div>
        </div>
      </div>

      {carregando ? (
        <div className="min-h-[640px] rounded-sm border border-[#e5e7eb] bg-white shadow-sm">
          <PainelCarregando mensagem="Carregando dashboard gerencial..." />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 rounded-sm border border-[#e5e7eb] bg-white px-4 py-4 shadow-sm lg:flex-nowrap lg:gap-6">
            <ResumoMetrica
              titulo="Inadimplentes"
              valor={String(dados.resumo.inadimplentes)}
              icone={<User className="h-5 w-5" />}
              corFundo="#dbeafe"
              corIcone="#3b82f6"
              onClick={() => setModalInadimplentes(true)}
            />
            <ResumoMetrica
              titulo="Serviços Atrasados"
              valor={String(dados.resumo.servicosAtrasados)}
              icone={<Package className="h-5 w-5" />}
              corFundo="#fee2e2"
              corIcone="#ef4444"
            />
            <ResumoMetrica
              titulo="Contas a Pagar"
              valor={formatarMoedaResumo(dados.resumo.contasAPagar)}
              icone={<ArrowDown className="h-5 w-5" />}
              corFundo="#cffafe"
              corIcone="#06b6d4"
            />
            <ResumoMetrica
              titulo="Contas a Receber"
              valor={formatarMoedaResumo(dados.resumo.contasAReceber)}
              icone={<DollarSign className="h-5 w-5" />}
              corFundo="#dcfce7"
              corIcone="#22c55e"
            />
            <div className="ml-auto w-full shrink-0 sm:w-auto">
              <select
                value={ano}
                onChange={(e) => setAno(Number(e.target.value))}
                className="h-[34px] w-full min-w-[100px] rounded-sm border border-[#d1d5db] bg-white px-3 text-[12px] text-[#374151] outline-none focus:border-[#4a90d9] sm:w-auto"
              >
                {anosOpcoes.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <CardCurvaAbc subtitulo="Serviços" legenda="Nº de Serviços">
              <GraficoCurvaAbc
                dados={dados.curvaAbc.servicos}
                onBarClick={abrirModalCurvaAbcServicos}
              />
            </CardCurvaAbc>
            <CardCurvaAbc subtitulo="Fornecedores" legenda="Fornecedores">
              <GraficoCurvaAbc
                dados={dados.curvaAbc.fornecedores}
                onBarClick={abrirModalCurvaAbcFornecedores}
              />
            </CardCurvaAbc>
            <CardCurvaAbc subtitulo="Clientes" legenda="Nº de Clientes">
              <GraficoCurvaAbc
                dados={dados.curvaAbc.clientes}
                onBarClick={abrirModalCurvaAbcClientes}
              />
            </CardCurvaAbc>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <CardDashboard titulo="Produção">
              <div className="mb-3 flex flex-wrap justify-end gap-2">
                <select
                  className="h-[30px] rounded-sm border border-[#d1d5db] bg-white px-2 text-[11px] text-[#374151] outline-none focus:border-[#4a90d9]"
                  value={mesProducao}
                  onChange={(e) => setMesProducao(Number(e.target.value))}
                >
                  {MESES_PRODUCAO_DASHBOARD.map((nome, index) => (
                    <option key={nome} value={index}>
                      {nome}
                    </option>
                  ))}
                </select>
                <select
                  className="h-[30px] min-w-[72px] rounded-sm border border-[#d1d5db] bg-white px-2 text-[11px] text-[#374151] outline-none focus:border-[#4a90d9]"
                  value={anoProducao}
                  onChange={(e) => setAnoProducao(Number(e.target.value))}
                >
                  {anosOpcoes.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <DonutProducao fatias={dadosProducao} total={totalProducao} />
            </CardDashboard>

            <div className="lg:col-span-2">
              <CardProdutividadeColaborador
                mes={mesProducao}
                ano={anoProducao}
                onMesChange={setMesProducao}
                onAnoChange={setAnoProducao}
                anosOpcoes={anosOpcoes}
                chartData={graficoProdutividadeColaborador.chartData}
                series={graficoProdutividadeColaborador.series}
                maxValor={graficoProdutividadeColaborador.maxValor}
              />
            </div>
          </div>

          <div className="grid gap-4">
            <CardProducaoPorSetor
              mes={mesProducao}
              ano={anoProducao}
              onMesChange={setMesProducao}
              onAnoChange={setAnoProducao}
              anosOpcoes={anosOpcoes}
              fatias={fatiasProducaoSetor}
              total={totalProducaoSetor}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <CardDashboard titulo="Pedidos">
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={dados.pedidos}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="mes" tick={tickAxis} axisLine={false} tickLine={false} />
                    <YAxis tick={tickAxis} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<TooltipSimples />} />
                    <Line
                      type="monotone"
                      dataKey="valor"
                      name="Pedidos"
                      stroke={COR.roxo}
                      strokeWidth={2}
                      dot={{ r: 3, fill: COR.roxo }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardDashboard>

            <CardDashboard titulo="Contas a Receber">
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dados.contasReceber}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="mes" tick={tickAxis} axisLine={false} tickLine={false} />
                    <YAxis tick={tickAxis} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(v) =>
                        Number(v ?? 0).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })
                      }
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 4,
                        border: "1px solid #e5e7eb",
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={28}
                      iconType="circle"
                      formatter={(value) => (
                        <span className="text-[11px] text-[#6b7280]">{value}</span>
                      )}
                    />
                    <Bar
                      dataKey="recebido"
                      name="Recebido"
                      fill={COR.roxo}
                      radius={[2, 2, 0, 0]}
                      maxBarSize={28}
                    />
                    <Bar
                      dataKey="aReceber"
                      name="A Receber"
                      fill={COR.roxoClaro}
                      radius={[2, 2, 0, 0]}
                      maxBarSize={28}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardDashboard>
          </div>

          <CardDashboard titulo="Receitas vs Despesas">
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={dados.receitasDespesas}
                  margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
                >
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="mes" tick={tickAxis} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={tickAxis}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) =>
                      v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                    }
                  />
                  <Tooltip
                    formatter={(v) =>
                      Number(v ?? 0).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })
                    }
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 4,
                      border: "1px solid #e5e7eb",
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    height={28}
                    iconType="circle"
                    formatter={(value) => (
                      <span className="text-[11px] text-[#6b7280]">{value}</span>
                    )}
                  />
                  <Line
                    type="monotone"
                    dataKey="receitas"
                    name="Receitas"
                    stroke={COR.verde}
                    strokeWidth={2}
                    dot={{ r: 3, fill: COR.verde }}
                  />
                  <Line
                    type="monotone"
                    dataKey="despesas"
                    name="Despesas"
                    stroke={COR.vermelho}
                    strokeWidth={2}
                    dot={{ r: 3, fill: COR.vermelho }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardDashboard>
        </div>
      )}

      <ModalInadimplentesDashboard
        aberto={modalInadimplentes}
        faturas={dados.inadimplentes}
        onFechar={() => setModalInadimplentes(false)}
      />

      <ModalCurvaAbcDetalheDashboard
        aberto={secaoAbcServicos !== null}
        titulo="Curva ABC Serviços"
        colunaNome="Serviço"
        mensagemVazia="Nenhum serviço nesta faixa."
        secao={secaoAbcServicos}
        onFechar={() => setSecaoAbcServicos(null)}
      />

      <ModalCurvaAbcDetalheDashboard
        aberto={secaoAbcFornecedores !== null}
        titulo="Curva ABC Fornecedores"
        colunaNome="Fornecedor"
        mensagemVazia="Nenhum fornecedor nesta faixa."
        secao={secaoAbcFornecedores}
        onFechar={() => setSecaoAbcFornecedores(null)}
      />

      <ModalCurvaAbcClientesDashboard
        aberto={secaoAbcClientes !== null}
        secao={secaoAbcClientes}
        onFechar={() => setSecaoAbcClientes(null)}
      />
    </div>
  );
}
