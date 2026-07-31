"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";
import {
  armazenamentoGaleriaEmAlerta,
  formatarTamanhoMbCard,
  LIMITE_ARMAZENAMENTO_BYTES,
  type UploadsResumoArmazenamento,
} from "@/lib/uploads-armazenamento";
import { cn } from "@/lib/utils";

export type UploadsResumoUi = UploadsResumoArmazenamento;

function percentualUsadoBarra(resumo: UploadsResumoUi) {
  const limite = resumo.limiteBytes ?? LIMITE_ARMAZENAMENTO_BYTES;
  if (limite <= 0 || resumo.bytesUsados <= 0) return 0;
  return Math.min(100, (resumo.bytesUsados / limite) * 100);
}

function rotuloPercentualUsado(resumo: UploadsResumoUi, locale: string) {
  const pct = percentualUsadoBarra(resumo);
  if (resumo.bytesUsados <= 0) return "0";
  const tag = locale === "pt" ? "pt-BR" : locale === "es" ? "es-ES" : "en-US";
  if (pct < 1) return (Math.round(pct * 10) / 10).toLocaleString(tag);
  return String(Math.round(pct));
}

export function PainelUploadsDashboard({
  titulo,
  resumo,
}: {
  titulo: string;
  resumo: UploadsResumoUi;
  onResumoAtualizado?: () => void;
}) {
  const { t, locale } = useI18n();
  const limiteBytes = resumo.limiteBytes ?? LIMITE_ARMAZENAMENTO_BYTES;
  const bytesLivres = Math.max(0, limiteBytes - resumo.bytesUsados);
  const pctUsado = percentualUsadoBarra(resumo);
  const textoPercentual = rotuloPercentualUsado(resumo, locale);
  const textoUsado = formatarTamanhoMbCard(resumo.bytesUsados);
  const textoLivre = formatarTamanhoMbCard(bytesLivres);
  const galeriaEsgotada = bytesLivres <= 0;
  const galeriaEmAlerta = armazenamentoGaleriaEmAlerta(resumo.bytesUsados);
  const tituloCard =
    resumo.onedriveAtivo || resumo.storageMode === "onedrive"
      ? t("dashboard.uploadsNuvem")
      : titulo;

  return (
    <section
      className={cn(
        "rounded border bg-white shadow-sm",
        galeriaEmAlerta ? "border-red-200" : "border-slate-200"
      )}
    >
      <div className="flex min-h-10 items-center justify-between border-b border-slate-100 px-4 py-2">
        <h2 className="text-sm font-medium text-slate-700">{tituloCard}</h2>
        <span className="text-[11px] font-semibold text-slate-600">
          {resumo.limiteGb} GB
        </span>
      </div>
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2 text-[11px]">
          <span className="text-slate-500">
            <span
              className={cn(
                "font-semibold",
                galeriaEmAlerta ? "text-red-500" : "text-sky-700"
              )}
            >
              {t("dashboard.usadoValor", { valor: textoUsado })}
            </span>
            <span className="mx-1 text-slate-300">·</span>
            <span className={galeriaEsgotada ? "font-semibold text-red-600" : ""}>
              {t("dashboard.livreValor", { valor: textoLivre })}
            </span>
          </span>
          <Link
            href="/app/liberar-espaco"
            className="shrink-0 font-medium text-[#4a90d9] hover:underline"
          >
            {t("dashboard.liberarEspaco")}
          </Link>
        </div>
        <div className="mb-4 flex gap-4 text-[11px]">
          <span className="flex items-center gap-1">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                galeriaEsgotada
                  ? "bg-red-500"
                  : galeriaEmAlerta
                    ? "bg-red-300"
                    : "bg-sky-500"
              )}
            />{" "}
            {t("dashboard.usado")}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> {t("dashboard.livre")}
          </span>
        </div>
        <div className="relative flex h-16 overflow-hidden rounded">
          <div
            className={cn(
              "shrink-0 transition-all duration-300",
              galeriaEsgotada
                ? "bg-red-500"
                : galeriaEmAlerta
                  ? "bg-red-300"
                  : "bg-sky-500"
            )}
            style={{
              width: `${pctUsado}%`,
              minWidth: resumo.bytesUsados > 0 ? 4 : 0,
            }}
          />
          <div className="min-w-0 flex-1 bg-emerald-400 transition-all duration-300" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-sm">
            {textoPercentual}%
          </div>
        </div>
        {galeriaEsgotada ? (
          <p className="mt-2 text-[11px] font-medium text-red-600">
            {t("dashboard.espacoEsgotado")}{" "}
            <Link href="/app/liberar-espaco" className="text-[#4a90d9] hover:underline">
              {t("dashboard.liberarEspaco")}
            </Link>{" "}
            {t("dashboard.paraExcluirArquivos")}
          </p>
        ) : galeriaEmAlerta ? (
          <p className="mt-2 text-[11px] font-medium text-red-500">
            {t("dashboard.espacoQuaseCheio")}{" "}
            <Link href="/app/liberar-espaco" className="text-[#4a90d9] hover:underline">
              {t("dashboard.liberarEspaco")}
            </Link>{" "}
            {t("dashboard.paraExcluirArquivos")}
          </p>
        ) : null}
        <div className="mt-3 flex justify-between text-[10px] text-slate-400">
          {[0, 20, 40, 60, 80, 100].map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
