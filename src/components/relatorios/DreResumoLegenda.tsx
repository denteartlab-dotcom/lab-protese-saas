"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";
import type { DreMatriz } from "@/lib/dre";
import {
  formatarTooltip,
  LEGENDA_RESUMO_DRE,
  MESES_ABREV_DRE,
} from "@/lib/dre-graficos";
import { trUi } from "@/lib/i18n/tr-ui";

type DreResumoLegendaProps = {
  matriz: DreMatriz;
};

export function DreResumoLegenda({ matriz }: DreResumoLegendaProps) {
  const { t } = useI18n();
  const [ativoId, setAtivoId] = useState<string | null>(null);

  const itens = useMemo(
    () =>
      LEGENDA_RESUMO_DRE.map((meta) => {
        const linha = matriz.linhas.find((l) => l.id === meta.id);
        return {
          ...meta,
          label: trUi(meta.label, t),
          valores: linha?.valores ?? Array(12).fill(0),
          total: linha?.total ?? 0,
        };
      }),
    [matriz, t]
  );

  const itemAtivo = itens.find((i) => i.id === ativoId);

  const maxMesAtivo = useMemo(() => {
    if (!itemAtivo) return 1;
    return Math.max(1, ...itemAtivo.valores.map((v) => Math.abs(v)));
  }, [itemAtivo]);

  return (
    <div className="border-t border-[#e5e7eb] bg-[#fafafa] px-5 py-4">
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5">
        {itens.map((item) => {
          const selecionado = ativoId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setAtivoId(selecionado ? null : item.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-sm border-0 bg-transparent p-0 text-[10px] text-[#6b7280] transition-colors hover:text-[#374151]",
                selecionado && "font-medium text-[#374151]"
              )}
            >
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.cor }}
              />
              {item.label}
            </button>
          );
        })}
      </div>

      {itemAtivo ? (
        <div className="mx-auto mt-5 w-full max-w-4xl rounded-sm border border-[#e5e7eb] bg-white px-4 py-4">
          <div className="mb-4 flex flex-col gap-2 border-b border-[#f3f4f6] pb-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px] font-medium text-[#374151]">{itemAtivo.label}</p>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-[#9ca3af]">
                {t("relatorio.comum.totalAno", { ano: matriz.ano })}
              </p>
              <p className="text-[18px] font-semibold leading-tight text-[#374151]">
                R$ {formatarTooltip(itemAtivo.total)}
              </p>
            </div>
          </div>

          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-[#9ca3af]">
            {t("relatorio.comum.porMes")}
          </p>
          <div className="flex h-28 items-end justify-between gap-0.5 border-b border-[#e5e7eb] pb-6">
            {itemAtivo.valores.map((valor, i) => {
              const altura = Math.max(4, (Math.abs(valor) / maxMesAtivo) * 88);
              return (
                <div
                  key={MESES_ABREV_DRE[i]}
                  className="flex min-w-0 flex-1 flex-col items-center gap-1"
                >
                  <span className="max-w-full truncate text-[8px] leading-none text-[#6b7280]">
                    {valor !== 0 ? formatarTooltip(valor) : ""}
                  </span>
                  <div
                    className="w-full max-w-[32px] rounded-t-sm transition-all duration-300"
                    style={{
                      height: `${altura}px`,
                      backgroundColor: itemAtivo.cor,
                      opacity: valor === 0 ? 0.25 : 1,
                    }}
                    title={`${MESES_ABREV_DRE[i]}: R$ ${formatarTooltip(valor)}`}
                  />
                  <span className="text-[9px] font-medium uppercase text-[#9ca3af]">
                    {MESES_ABREV_DRE[i]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
