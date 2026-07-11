"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import type { TipoPrazoProducao } from "@/lib/controle-producao-prazos";
import type { GrupoOsPainelServicos } from "@/lib/painel-servicos-dashboard";
import { labelStatusTrabalho } from "@/lib/i18n/status-trabalho-i18n";
import { localeDataIntl } from "@/lib/i18n/tr-ui";
import { ModalOsResumoDashboard } from "@/components/dashboard/ModalOsResumoDashboard";

type Props = {
  titulo: string;
  valor: number;
  tom: "warning" | "danger";
  painelControle: "atrasados" | "vencendo";
  filtros: React.ReactNode;
  grupos: GrupoOsPainelServicos[];
  tipoPrazo: TipoPrazoProducao;
  expandido: boolean;
  onToggleExpandir: () => void;
  labelVisualizar: string;
  labelImprimir: string;
  linkImprimir?: string;
  onImprimir?: () => void;
};

type CampoOrdenacao = "os" | "data";
type DirecaoOrdenacao = "asc" | "desc";

function ordenarGruposPainel(
  lista: GrupoOsPainelServicos[],
  campo: CampoOrdenacao,
  direcao: DirecaoOrdenacao,
  localeTag: string
) {
  const copia = [...lista];
  copia.sort((a, b) => {
    let diff = 0;
    if (campo === "os") {
      diff = a.numeroOs - b.numeroOs;
    } else {
      const pa = a.dataExibicao === "—" ? "" : a.dataExibicao;
      const pb = b.dataExibicao === "—" ? "" : b.dataExibicao;
      diff = pa.localeCompare(pb, localeTag);
    }
    return direcao === "desc" ? -diff : diff;
  });
  return copia;
}

export function PainelServicosDashboard({
  titulo,
  valor,
  tom,
  painelControle,
  filtros,
  grupos,
  tipoPrazo,
  expandido,
  onToggleExpandir,
  labelVisualizar,
  labelImprimir,
  linkImprimir,
  onImprimir,
}: Props) {
  const { t, locale } = useI18n();
  const localeTag = localeDataIntl(locale);

  const outline =
    tom === "warning"
      ? "border-amber-400 text-amber-600 hover:bg-amber-50"
      : "border-red-400 text-red-600 hover:bg-red-50";
  const solid =
    tom === "warning"
      ? "border-amber-500 bg-amber-500 text-white hover:bg-amber-600"
      : "border-red-500 bg-red-500 text-white hover:bg-red-600";
  const badgeOs =
    tom === "warning"
      ? "bg-amber-100 text-amber-800"
      : "bg-red-100 text-red-700";

  const [ordenacao, setOrdenacao] = useState<{
    campo: CampoOrdenacao;
    direcao: DirecaoOrdenacao;
  }>({ campo: "os", direcao: "desc" });
  const [grupoModal, setGrupoModal] = useState<GrupoOsPainelServicos | null>(null);

  const ordenados = useMemo(
    () => ordenarGruposPainel(grupos, ordenacao.campo, ordenacao.direcao, localeTag),
    [grupos, ordenacao, localeTag]
  );

  function alternarOrdenacao(campo: CampoOrdenacao) {
    setOrdenacao((atual) =>
      atual.campo === campo
        ? { campo, direcao: atual.direcao === "desc" ? "asc" : "desc" }
        : { campo, direcao: "desc" }
    );
  }

  function handleToggleExpandir() {
    if (expandido) setGrupoModal(null);
    onToggleExpandir();
  }

  return (
    <div
      className={`relative rounded border border-slate-200 bg-white shadow-sm ${
        expandido ? "min-h-[360px]" : "min-h-[118px]"
      }`}
    >
      <div className="px-4 pb-3 pt-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] font-medium text-slate-700">{titulo}</p>
          <div className="flex shrink-0 items-center gap-1.5">{filtros}</div>
        </div>
        <p className="mt-2 text-[42px] font-semibold leading-none text-slate-800">{valor}</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleToggleExpandir}
            className={`rounded border px-3 py-1 text-[11px] font-medium ${outline} ${
              expandido ? "ring-1 ring-offset-1" : ""
            } ${tom === "warning" ? (expandido ? "ring-amber-300" : "") : expandido ? "ring-red-300" : ""}`}
          >
            {labelVisualizar}
          </button>
          {onImprimir ? (
            <button
              type="button"
              onClick={onImprimir}
              className={`rounded border px-3 py-1 text-[11px] font-medium ${solid}`}
            >
              {labelImprimir}
            </button>
          ) : linkImprimir ? (
            <a
              href={linkImprimir}
              className={`rounded border px-3 py-1 text-[11px] font-medium ${solid}`}
            >
              {labelImprimir}
            </a>
          ) : null}
        </div>
      </div>

      {expandido && (
        <div className="border-t border-slate-100 px-3 pb-3">
          <div className="mb-1 flex justify-end gap-3 pr-1 pt-2 text-[10px]">
            <BotaoOrdenacao
              label={t("dashboard.os")}
              ativo={ordenacao.campo === "os"}
              direcao={ordenacao.direcao}
              onClick={() => alternarOrdenacao("os")}
              tituloDesc={t("dashboard.ordenacaoMaiorPrimeiro")}
              tituloAsc={t("dashboard.ordenacaoMenorPrimeiro")}
            />
            <BotaoOrdenacao
              label={t("dashboard.data")}
              ativo={ordenacao.campo === "data"}
              direcao={ordenacao.direcao}
              onClick={() => alternarOrdenacao("data")}
              tituloDesc={t("dashboard.ordenacaoMaiorPrimeiro")}
              tituloAsc={t("dashboard.ordenacaoMenorPrimeiro")}
            />
          </div>
          <div className="max-h-[min(42vh,300px)] overflow-y-auto">
            {ordenados.length === 0 ? (
              <p className="py-8 text-center text-[12px] text-slate-400">
                {t("dashboard.nenhumServicoFiltro")}
              </p>
            ) : (
              <ul>
                {ordenados.map((grupo) => {
                  const situacao = labelStatusTrabalho(t, grupo.status);
                  return (
                    <li key={grupo.chave} className="border-b border-slate-100 last:border-0">
                      <div className="grid grid-cols-[52px_1fr] gap-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => setGrupoModal(grupo)}
                          className={`flex h-9 w-9 items-center justify-center rounded text-[13px] font-bold transition hover:opacity-80 ${badgeOs}`}
                          title={t("dashboard.verResumoOs")}
                        >
                          {grupo.numeroOs}
                        </button>
                        <div className="min-w-0 text-[11px] leading-snug text-slate-600">
                          <p className="font-semibold text-slate-700">
                            {[
                              grupo.dataExibicao,
                              `${t("dashboard.caixa")}: ${grupo.caixa || "—"}`,
                              situacao,
                            ].join(" | ")}
                          </p>
                          <p className="mt-0.5 truncate">
                            {grupo.servicos.join(" | ")} | {t("dashboard.paciente")}:{" "}
                            {grupo.pacienteNome}
                          </p>
                          {grupo.clienteNome !== "—" ? (
                            <p className="mt-0.5 truncate text-slate-500">
                              {t("dashboard.cliente")}: {grupo.clienteNome}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      <ModalOsResumoDashboard
        open={grupoModal !== null}
        onClose={() => setGrupoModal(null)}
        grupo={grupoModal}
        painelControle={painelControle}
        tipoPrazo={tipoPrazo}
      />
    </div>
  );
}

function BotaoOrdenacao({
  label,
  ativo,
  direcao,
  onClick,
  tituloDesc,
  tituloAsc,
}: {
  label: string;
  ativo: boolean;
  direcao: DirecaoOrdenacao;
  onClick: () => void;
  tituloDesc: string;
  tituloAsc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-0.5 transition hover:text-slate-600 ${
        ativo ? "font-medium text-slate-500" : "text-slate-400"
      }`}
      title={direcao === "desc" ? tituloDesc : tituloAsc}
    >
      {label}
      {ativo ? (direcao === "desc" ? " ↓" : " ↑") : ""}
    </button>
  );
}
