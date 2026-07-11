"use client";

import { Search } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { CampoDataBr } from "@/components/campo-data-br";
import type { FiltrosTempoProducao, StatusTempoProducao } from "@/lib/tempo-producao-relatorio";
import { STATUS_TEMPO_PRODUCAO } from "@/lib/tempo-producao-relatorio";
import { labelStatusTempo } from "@/components/relatorios/tempo-producao/tempo-i18n";

type Opcoes = {
  dentistas: string[];
  colaboradores: string[];
  etapas: string[];
  tiposServico: string[];
};

type Props = {
  filtros: FiltrosTempoProducao;
  opcoes: Opcoes;
  onChange: (filtros: FiltrosTempoProducao) => void;
};

const selectClass =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200";

export function ReportFilters({ filtros, opcoes, onChange }: Props) {
  const { t } = useI18n();

  function patch(partial: Partial<FiltrosTempoProducao>) {
    onChange({ ...filtros, ...partial });
  }

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/90">
      <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">{t("relatorio.tempo.filtros")}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <CampoDataBr
          label={t("relatorio.tempo.periodoInicio")}
          value={filtros.dataInicio ?? ""}
          onChange={(v) => patch({ dataInicio: v || undefined })}
        />
        <CampoDataBr
          label={t("relatorio.tempo.periodoFim")}
          value={filtros.dataFim ?? ""}
          onChange={(v) => patch({ dataFim: v || undefined })}
        />
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">{t("relatorio.tempo.dentista")}</label>
          <select
            className={selectClass}
            value={filtros.dentista ?? ""}
            onChange={(e) => patch({ dentista: e.target.value || undefined })}
          >
            <option value="">{t("relatorio.opcao.todos")}</option>
            {opcoes.dentistas.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">{t("relatorio.filtro.colaborador")}</label>
          <select
            className={selectClass}
            value={filtros.colaborador ?? ""}
            onChange={(e) => patch({ colaborador: e.target.value || undefined })}
          >
            <option value="">{t("relatorio.opcao.todos")}</option>
            {opcoes.colaboradores.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">{t("relatorio.filtro.etapa")}</label>
          <select
            className={selectClass}
            value={filtros.etapa ?? ""}
            onChange={(e) => patch({ etapa: e.target.value || undefined })}
          >
            <option value="">{t("relatorio.opcao.todas")}</option>
            {opcoes.etapas.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">{t("relatorio.filtro.status")}</label>
          <select
            className={selectClass}
            value={filtros.status ?? ""}
            onChange={(e) =>
              patch({ status: (e.target.value as StatusTempoProducao) || undefined })
            }
          >
            <option value="">{t("relatorio.opcao.todos")}</option>
            {(Object.keys(STATUS_TEMPO_PRODUCAO) as StatusTempoProducao[]).map((s) => (
              <option key={s} value={s}>
                {labelStatusTempo(s, t)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">{t("relatorio.tempo.tipoServico")}</label>
          <select
            className={selectClass}
            value={filtros.tipoServico ?? ""}
            onChange={(e) => patch({ tipoServico: e.target.value || undefined })}
          >
            <option value="">{t("relatorio.opcao.todos")}</option>
            {opcoes.tiposServico.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col justify-end gap-2 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(filtros.apenasAtrasados)}
              onChange={(e) => patch({ apenasAtrasados: e.target.checked })}
              className="rounded border-slate-300"
            />
            {t("relatorio.tempo.apenasAtrasados")}
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(filtros.apenasCriticos)}
              onChange={(e) => patch({ apenasCriticos: e.target.checked })}
              className="rounded border-slate-300"
            />
            {t("relatorio.tempo.apenasCriticos")}
          </label>
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <label className="mb-1 block text-xs font-medium text-slate-600">{t("relatorio.filtro.buscar")}</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder={t("relatorio.tempo.buscarPlaceholder")}
              value={filtros.busca ?? ""}
              onChange={(e) => patch({ busca: e.target.value || undefined })}
              className={`${selectClass} pl-9`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
