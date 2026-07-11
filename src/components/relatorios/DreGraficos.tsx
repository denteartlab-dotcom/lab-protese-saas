"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { DreMenuDownloadComparativo } from "@/components/relatorios/DreMenuDownloadComparativo";
import { useI18n } from "@/components/i18n-provider";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DreResumoLegenda } from "@/components/relatorios/DreResumoLegenda";
import type { DreMatriz } from "@/lib/dre";
import {
  corBarraMargemContribuicao,
  dominioMonetario2k,
  dominioMonetarioSmart,
  formatarEixoMilhares,
  formatarEixoY,
  formatarTooltip,
  mediaSerieAnual,
  MESES_SELECT_DRE,
  montarComposicaoDreMes,
  montarDadosGraficosDre,
  TICKS_LUCRATIVIDADE,
  TICKS_PERCENTUAL_MC,
  ticksMonetario2k,
  ticksMonetarioSmart,
} from "@/lib/dre-graficos";

const selectComposicaoClass =
  "mt-2 h-[34px] min-w-[148px] rounded-sm border border-[#93c5fd] bg-white px-2 text-[12px] lowercase text-[#374151] outline-none focus:border-[#4a90d9]";

const COR = {
  receitaBruta: "#66bb6a",
  opex: "#ef5350",
  lucroLiquido: "#42a5f5",
  percentualMC: "#66bb6a",
  metaMC: "#ef5350",
  faixaMetaMC: "#ffcdd2",
  variaveis: "#66bb6a",
  fixas: "#4a90d9",
  mcPositiva: "#66bb6a",
  mcReduzida: "#ff9800",
  receitaLiquidaBar: "#42a5f5",
  pontoEquilibrio: "#ef5350",
  investimentos: "#66bb6a",
  lucratividade: "#4caf50",
  receitasLegenda: "#4a90d9",
  despesasLegenda: "#e53935",
  lucroLegenda: "#43a047",
} as const;

const tickAxis = { fontSize: 11, fill: "#9ca3af" };
const gridProps = {
  stroke: "#e8e8e8",
  strokeDasharray: "3 3",
};

function TooltipValor({
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
    <div className="rounded-sm border border-[#e5e7eb] bg-white px-3 py-2 text-[11px] shadow-sm">
      <p className="mb-1 font-medium text-[#374151]">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color ?? "#374151" }}>
          {p.name}: R$ {formatarTooltip(Number(p.value ?? 0))}
        </p>
      ))}
    </div>
  );
}

function TituloSmart({ children }: { children: string }) {
  return (
    <h4 className="text-[11px] font-normal uppercase tracking-wide text-[#9ca3af]">
      {children}
    </h4>
  );
}

function CabecalhoGraficoSmart({
  titulo,
  legenda,
  acaoDireita,
}: {
  titulo: string;
  legenda: ReactNode;
  acaoDireita?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <TituloSmart>{titulo}</TituloSmart>
        <div className="mt-2">{legenda}</div>
      </div>
      {acaoDireita}
    </div>
  );
}

function LegendaPonto({
  cor,
  label,
  formato = "circulo",
}: {
  cor: string;
  label: string;
  formato?: "circulo" | "quadrado";
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-[#6b7280]">
      <span
        className={
          formato === "quadrado"
            ? "inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
            : "inline-block h-2.5 w-2.5 shrink-0 rounded-full"
        }
        style={{ backgroundColor: cor }}
      />
      {label}
    </span>
  );
}

function CabecalhoIndicadorSmart({
  titulo,
  subtitulo,
  nota,
  media,
  legenda,
}: {
  titulo: string;
  subtitulo?: string;
  nota: string;
  media: number;
  legenda: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <TituloSmart>{titulo}</TituloSmart>
        {subtitulo ? (
          <p className="mt-0.5 text-[10px] font-normal uppercase tracking-wide text-[#9ca3af]">
            {subtitulo}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div className="min-w-[76px] rounded border border-[#e5e7eb] bg-[#fafafa] px-3 py-2 text-center">
            <p className="text-[10px] text-[#9ca3af]">{t("relatorio.comum.media")}</p>
            <p className="text-[13px] font-semibold leading-tight text-[#66bb6a]">
              {formatarTooltip(media)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">{legenda}</div>
        </div>
      </div>
      <p className="max-w-[240px] text-[10px] leading-relaxed text-[#9ca3af] sm:text-right">
        {nota}
      </p>
    </div>
  );
}

function TooltipComparativo({
  active,
  payload,
  label,
  tipo,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
  tipo: "moeda" | "percentual";
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-sm border border-[#e5e7eb] bg-white px-3 py-2 text-[11px] shadow-sm">
      <p className="mb-1 font-medium capitalize text-[#374151]">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color ?? "#374151" }}>
          {p.name}:{" "}
          {tipo === "percentual"
            ? `${Number(p.value ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
            : `R$ ${formatarTooltip(Number(p.value ?? 0))}`}
        </p>
      ))}
    </div>
  );
}

type DreGraficosProps = {
  matriz: DreMatriz;
  carregando?: boolean;
};

export function DreGraficos({ matriz, carregando }: DreGraficosProps) {
  const { t } = useI18n();
  const [mesComposicao, setMesComposicao] = useState(() => new Date().getMonth());
  const comparativoChartRef = useRef<HTMLDivElement>(null);
  const dados = useMemo(() => montarDadosGraficosDre(matriz), [matriz]);
  const composicao = useMemo(
    () => montarComposicaoDreMes(matriz, mesComposicao),
    [matriz, mesComposicao]
  );

  const fatiasPizza = useMemo(
    () =>
      composicao.itens.filter(
        (i) => i.valor > 0 && i.id !== "receita_liquida" && i.id !== "lucro_liquido"
      ),
    [composicao.itens]
  );

  const domMonetario = useMemo(
    () =>
      dominioMonetarioSmart(
        dados.flatMap((d) => [d.receitaBruta, d.opex, d.lucroLiquido])
      ),
    [dados]
  );

  const ticksMonetario = useMemo(
    () => ticksMonetarioSmart(domMonetario[1]),
    [domMonetario]
  );

  const domMcPe = useMemo(
    () =>
      dominioMonetario2k(
        dados.flatMap((d) => [
          d.margemContribuicaoBar,
          d.receitaLiquida,
          d.pontoEquilibrio,
        ])
      ),
    [dados]
  );

  const ticksMcPe = useMemo(() => ticksMonetario2k(domMcPe[1]), [domMcPe]);

  const mediaMargemContribuicao = useMemo(
    () => mediaSerieAnual(dados.map((d) => d.margemContribuicao)),
    [dados]
  );

  const mediaPontoEquilibrio = useMemo(
    () => mediaSerieAnual(dados.map((d) => d.pontoEquilibrio)),
    [dados]
  );

  if (carregando) {
    return (
      <div className="py-20 text-center text-[12px] text-[#9ca3af]">
        {t("relatorio.carregandoGraficos")}
      </div>
    );
  }

  const margem = { top: 12, right: 16, left: 8, bottom: 8 };

  return (
    <div className="dre-graficos print:hidden">
      {/* 1 — RECEITA / DESPESAS / LUCRO */}
      <section className="border-b border-[#e5e7eb] px-5 py-6">
        <CabecalhoGraficoSmart
          titulo={t("relatorio.dre.graficoReceitaDespesaLucro")}
          acaoDireita={
            <DreMenuDownloadComparativo
              chartRef={comparativoChartRef}
              dados={dados}
              ano={matriz.ano}
            />
          }
          legenda={
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <LegendaPonto
                cor={COR.receitaBruta}
                label={t("relatorio.dre.receitaOperacionalBruta")}
              />
              <LegendaPonto cor={COR.opex} label={t("relatorio.dre.opex")} />
              <LegendaPonto cor={COR.lucroLiquido} label={t("relatorio.dre.lucroLiquido")} />
            </div>
          }
        />
        <div ref={comparativoChartRef} className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dados} margin={margem}>
              <CartesianGrid {...gridProps} vertical />
              <XAxis
                dataKey="mes"
                tick={tickAxis}
                axisLine={{ stroke: "#e5e7eb" }}
                tickLine={false}
                interval={0}
              />
              <YAxis
                domain={domMonetario}
                ticks={ticksMonetario}
                tick={tickAxis}
                tickFormatter={formatarEixoMilhares}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip content={<TooltipComparativo tipo="moeda" />} />
              <Line
                type="monotone"
                dataKey="receitaBruta"
                name={t("relatorio.dre.receitaOperacionalBruta")}
                stroke={COR.receitaBruta}
                strokeWidth={1.5}
                dot={{ r: 2.5, fill: COR.receitaBruta, strokeWidth: 0 }}
                activeDot={{ r: 3.5 }}
              />
              <Line
                type="monotone"
                dataKey="opex"
                name={t("relatorio.dre.opex")}
                stroke={COR.opex}
                strokeWidth={1.5}
                dot={{ r: 2.5, fill: COR.opex, strokeWidth: 0 }}
                activeDot={{ r: 3.5 }}
              />
              <Line
                type="monotone"
                dataKey="lucroLiquido"
                name={t("relatorio.dre.lucroLiquido")}
                stroke={COR.lucroLiquido}
                strokeWidth={1.5}
                dot={{ r: 2.5, fill: COR.lucroLiquido, strokeWidth: 0 }}
                activeDot={{ r: 3.5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 2 — Margem de Contribuição % */}
      <section className="border-b border-[#e5e7eb] px-5 py-6">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <TituloSmart>{t("relatorio.dre.margemContribuicaoPct")}</TituloSmart>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <LegendaPonto cor={COR.percentualMC} label={t("relatorio.dre.percentualMc")} />
              <LegendaPonto cor={COR.metaMC} label={t("relatorio.dre.metaReferencia50")} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#6b7280]">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-5 rounded bg-[#66bb6a]" />
              {t("relatorio.dre.percentualMc")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-0 w-5 border-t-2 border-dashed"
                style={{ borderColor: COR.metaMC }}
              />
              {t("relatorio.dre.metaReferencia50")}
            </span>
          </div>
        </div>
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dados} margin={margem}>
              <CartesianGrid {...gridProps} vertical />
              <XAxis
                dataKey="mes"
                tick={tickAxis}
                axisLine={{ stroke: "#e5e7eb" }}
                tickLine={false}
                interval={0}
              />
              <YAxis
                type="number"
                domain={[0, 100]}
                ticks={TICKS_PERCENTUAL_MC}
                allowDecimals={false}
                allowDataOverflow
                tick={tickAxis}
                tickFormatter={(v) => `${v}%`}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <ReferenceArea
                y1={0}
                y2={50}
                fill={COR.faixaMetaMC}
                fillOpacity={0.55}
                stroke="none"
                ifOverflow="hidden"
              />
              <ReferenceLine
                y={50}
                stroke={COR.metaMC}
                strokeDasharray="5 5"
                strokeWidth={1.5}
              />
              <Tooltip content={<TooltipComparativo tipo="percentual" />} />
              <Area
                type="monotone"
                dataKey="percentualMC"
                name={t("relatorio.dre.percentualMc")}
                stroke={COR.percentualMC}
                fill="#c8e6c9"
                fillOpacity={0.65}
                strokeWidth={1.5}
                baseValue={0}
                dot={{ r: 2.5, fill: COR.percentualMC, strokeWidth: 0 }}
                activeDot={{ r: 3.5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 3 — Margem de Contribuição (R$) */}
      <section className="border-b border-[#e5e7eb] px-5 py-6">
        <CabecalhoIndicadorSmart
          titulo={t("relatorio.dre.margemContribuicao")}
          subtitulo={t("relatorio.dre.margemContribuicaoValor")}
          nota={t("relatorio.dre.margemContribuicaoNota")}
          media={mediaMargemContribuicao}
          legenda={
            <>
              <LegendaPonto
                cor={COR.mcPositiva}
                label={t("relatorio.dre.mcPositiva")}
                formato="quadrado"
              />
              <LegendaPonto
                cor={COR.mcReduzida}
                label={t("relatorio.dre.mcReduzida")}
                formato="quadrado"
              />
            </>
          }
        />
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados} margin={margem} barCategoryGap="18%">
              <CartesianGrid {...gridProps} vertical={false} />
              <XAxis
                dataKey="mes"
                tick={tickAxis}
                axisLine={{ stroke: "#e5e7eb" }}
                tickLine={false}
                interval={0}
              />
              <YAxis
                domain={domMcPe}
                ticks={ticksMcPe}
                tick={tickAxis}
                tickFormatter={formatarEixoMilhares}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip content={<TooltipComparativo tipo="moeda" />} />
              <Bar
                dataKey="margemContribuicaoBar"
                name={t("relatorio.dre.margemContribuicao")}
                radius={[2, 2, 0, 0]}
                maxBarSize={48}
              >
                {dados.map((p) => (
                  <Cell
                    key={p.mes}
                    fill={corBarraMargemContribuicao(
                      p.margemContribuicao,
                      p.percentualMC
                    )}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 4 — Ponto de Equilíbrio Mensal */}
      <section className="border-b border-[#e5e7eb] px-5 py-6">
        <CabecalhoIndicadorSmart
          titulo={t("relatorio.dre.pontoEquilibrioMensal")}
          nota={t("relatorio.dre.pontoEquilibrioNota")}
          media={mediaPontoEquilibrio}
          legenda={
            <>
              <LegendaPonto
                cor={COR.receitaLiquidaBar}
                label={t("relatorio.dre.receitaLiquidaReal")}
                formato="quadrado"
              />
              <LegendaPonto
                cor={COR.pontoEquilibrio}
                label={t("relatorio.dre.pontoEquilibrio")}
              />
            </>
          }
        />
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dados} margin={margem}>
              <CartesianGrid {...gridProps} vertical={false} />
              <XAxis
                dataKey="mes"
                tick={tickAxis}
                axisLine={{ stroke: "#e5e7eb" }}
                tickLine={false}
                interval={0}
              />
              <YAxis
                domain={domMcPe}
                ticks={ticksMcPe}
                tick={tickAxis}
                tickFormatter={formatarEixoMilhares}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip content={<TooltipComparativo tipo="moeda" />} />
              <Bar
                dataKey="receitaLiquida"
                name={t("relatorio.dre.receitaLiquidaReal")}
                fill={COR.receitaLiquidaBar}
                radius={[2, 2, 0, 0]}
                maxBarSize={48}
              />
              <Line
                type="monotone"
                dataKey="pontoEquilibrio"
                name={t("relatorio.dre.pontoEquilibrio")}
                stroke="none"
                dot={{
                  r: 4,
                  fill: COR.pontoEquilibrio,
                  strokeWidth: 0,
                }}
                activeDot={{ r: 5, fill: COR.pontoEquilibrio }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 5 — Lucratividade % */}
      <section className="border-b border-[#e5e7eb] px-5 py-6">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <TituloSmart>{t("relatorio.dre.lucratividadePct")}</TituloSmart>
          <p className="text-[10px] text-[#9ca3af] sm:text-right">
            {t("relatorio.dre.lucratividadeNota")}
          </p>
        </div>
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados} margin={margem} barCategoryGap="18%">
              <CartesianGrid {...gridProps} vertical={false} />
              <XAxis
                dataKey="mes"
                tick={tickAxis}
                axisLine={{ stroke: "#e5e7eb" }}
                tickLine={false}
                interval={0}
              />
              <YAxis
                domain={[0, 120]}
                ticks={TICKS_LUCRATIVIDADE}
                tick={tickAxis}
                tickFormatter={(v) => `${v}%`}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip content={<TooltipComparativo tipo="percentual" />} />
              <Bar
                dataKey="lucratividadePct"
                name={t("relatorio.dre.lucratividade")}
                fill={COR.lucratividade}
                radius={[2, 2, 0, 0]}
                maxBarSize={52}
              >
                <LabelList
                  dataKey="lucratividadePct"
                  position="center"
                  formatter={(v) =>
                    Number(v) > 0
                      ? `${Number(v).toLocaleString("pt-BR", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}%`
                      : ""
                  }
                  fill="#ffffff"
                  fontSize={11}
                  fontWeight={600}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <DreResumoLegenda matriz={matriz} />

      {/* Composição do DRE */}
      <section className="border-t border-[#e5e7eb] px-5 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-[12px] font-normal uppercase tracking-wide text-[#94a3b8]">
              {t("relatorio.dre.composicaoTitulo")}
            </h3>
            <p className="mt-0.5 text-[11px] text-[#9ca3af]">
              {t("relatorio.dre.composicaoSubtitulo")}
            </p>
            <select
              className={selectComposicaoClass}
              value={mesComposicao}
              onChange={(e) => setMesComposicao(Number(e.target.value))}
              aria-label={t("relatorio.dre.mesComposicao")}
            >
              {MESES_SELECT_DRE.map((mes, i) => (
                <option key={mes} value={i}>
                  {mes}
                </option>
              ))}
            </select>
          </div>
          <div className="text-right sm:pt-1">
            <p className="text-[11px] text-[#9ca3af]">{t("relatorio.dre.receitaOperacionalBruta")}</p>
            <p className="mt-0.5 text-[20px] font-semibold leading-tight text-[#374151]">
              R$ {formatarTooltip(composicao.receitaBruta)}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center">
          <div className="mx-auto h-[260px] w-full max-w-[320px]">
            {fatiasPizza.length === 0 ? (
              <div className="flex h-full items-center justify-center text-[12px] text-[#9ca3af]">
                {t("relatorio.comum.semValoresMes")}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={fatiasPizza}
                    dataKey="valor"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={96}
                    paddingAngle={1}
                  >
                    {fatiasPizza.map((item) => (
                      <Cell key={item.id} fill={item.cor} stroke="#fff" strokeWidth={1} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) =>
                      `R$ ${formatarTooltip(Number(v ?? 0))}`
                    }
                    contentStyle={{ fontSize: 11 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <ul className="space-y-2.5 text-[11px]">
            {composicao.itens.map((item) => (
              <li key={item.id}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[#6b7280]">
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: item.cor }}
                    />
                    {item.label}
                  </span>
                  <span className="shrink-0 font-medium text-[#374151]">
                    R$ {formatarTooltip(item.valor)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#f3f4f6]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(0, item.percentual))}%`,
                      backgroundColor: item.cor,
                    }}
                  />
                </div>
                <p className="mt-0.5 text-right text-[10px] text-[#9ca3af]">
                  {item.percentual.toLocaleString("pt-BR", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                  {t("relatorio.comum.percentReceitaBruta")}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
