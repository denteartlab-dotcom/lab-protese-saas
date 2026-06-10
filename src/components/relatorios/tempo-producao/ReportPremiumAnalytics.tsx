"use client";

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { GraficosTempoProducao } from "@/lib/tempo-producao-relatorio";
import { corAvatar, corEtapaPremium, iniciaisAvatar } from "@/lib/tempo-producao-premium";
import { cn, temColaborador } from "@/lib/utils";

type Props = { graficos: GraficosTempoProducao };

function cardClass() {
  return "rounded-2xl border border-[#e8ecf2] bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06),0_8px_24px_rgba(15,23,42,0.06)]";
}

export function ReportPremiumAnalytics({ graficos }: Props) {
  const barras =
    graficos.tempoMedioPorEtapaBar.length > 0
      ? graficos.tempoMedioPorEtapaBar.map((b) => ({
          ...b,
          cor: corEtapaPremium(b.etapa).bar,
        }))
      : [{ etapa: "Sem dados", dias: 0, cor: "#cbd5e1" }];

  const donut = graficos.osAtrasadasPorEtapaDonut.length
    ? graficos.osAtrasadasPorEtapaDonut
    : [{ etapa: "Nenhuma", quantidade: 1, percentual: 100, cor: "#e2e8f0" }];

  const totalDonut = donut.reduce((s, d) => s + d.quantidade, 0);

  const ranking = graficos.desempenhoColaboradores.length
    ? graficos.desempenhoColaboradores
    : [{ colaborador: "Sem dados", osEntregues: 0, tempoMedio: 0, atrasos: 0 }];

  return (
    <div className="grid gap-5 xl:grid-cols-3 tv:gap-6">
      <div className={cardClass()}>
        <h3 className="text-base font-bold text-slate-900">Tempo médio por etapa</h3>
        <p className="mb-5 text-sm text-slate-500">Dias parados em cada etapa do fluxo</p>
        <div className="h-[280px] w-full tv:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barras} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="etapa"
                width={110}
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid #e8ecf2", fontSize: 12 }}
                formatter={(v) => [`${Number(v ?? 0)} dias`, "Média"]}
              />
              <Bar dataKey="dias" radius={[0, 8, 8, 0]} maxBarSize={18}>
                {barras.map((entry, i) => (
                  <Cell key={`${entry.etapa}-${i}`} fill={entry.cor} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex flex-wrap gap-3">
          {barras.slice(0, 6).map((b) => (
            <span key={b.etapa} className="text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{b.etapa}</span>{" "}
              {b.dias.toLocaleString("pt-BR")} dias
            </span>
          ))}
        </div>
      </div>

      <div className={cardClass()}>
        <h3 className="text-base font-bold text-slate-900">OS atrasadas por etapa</h3>
        <p className="mb-4 text-sm text-slate-500">Distribuição dos gargalos com atraso</p>
        <div className="flex items-center gap-4">
          <div className="relative h-[220px] w-[220px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donut}
                  dataKey="quantidade"
                  nameKey="etapa"
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={96}
                  paddingAngle={3}
                >
                  {donut.map((entry, i) => (
                    <Cell key={`${entry.etapa}-${i}`} fill={corEtapaPremium(entry.etapa).bar} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-slate-900">{totalDonut}</span>
              <span className="text-xs text-slate-500">atrasadas</span>
            </div>
          </div>
          <ul className="min-w-0 flex-1 space-y-2.5">
            {donut.map((d) => (
              <li key={d.etapa} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 truncate text-slate-700">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: corEtapaPremium(d.etapa).bar }}
                  />
                  {d.etapa}
                </span>
                <span className="shrink-0 font-semibold text-slate-800">
                  {d.quantidade}{" "}
                  <span className="text-xs font-normal text-slate-400">({d.percentual}%)</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={cardClass()}>
        <h3 className="text-base font-bold text-slate-900">Desempenho dos colaboradores</h3>
        <p className="mb-4 text-sm text-slate-500">Ranking por entregas e atrasos</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="pb-3 pr-2">Colaborador</th>
                <th className="pb-3 px-2 text-center">OS entregues</th>
                <th className="pb-3 px-2 text-center">Tempo médio</th>
                <th className="pb-3 pl-2 text-center">Atrasos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {ranking.map((row) => (
                <tr key={row.colaborador} className="group hover:bg-slate-50/80">
                  <td className="py-3 pr-2">
                    {temColaborador(row.colaborador) ? (
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white",
                            corAvatar(row.colaborador)
                          )}
                        >
                          {iniciaisAvatar(row.colaborador)}
                        </span>
                        <span className="font-medium text-slate-800">{row.colaborador}</span>
                      </div>
                    ) : null}
                  </td>
                  <td className="px-2 py-3 text-center font-semibold text-slate-700">
                    {row.osEntregues}
                  </td>
                  <td className="px-2 py-3 text-center text-slate-600">
                    {row.tempoMedio.toLocaleString("pt-BR")} dias
                  </td>
                  <td className="py-3 pl-2 text-center">
                    <span
                      className={cn(
                        "inline-flex h-7 min-w-7 items-center justify-center rounded-full text-xs font-bold text-white",
                        row.atrasos >= 5
                          ? "bg-red-500"
                          : row.atrasos >= 2
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                      )}
                    >
                      {row.atrasos}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
