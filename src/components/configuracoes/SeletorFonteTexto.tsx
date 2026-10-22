"use client";

import { useI18n } from "@/components/i18n-provider";
import type { MessageKey } from "@/lib/i18n/messages";
import { FONTES_IMPRESSAO, type FonteImpressao } from "@/lib/fonte-impressao";

const ROTULO_FONTE: Record<FonteImpressao, MessageKey> = {
  arial: "settings.etiquetaEntrega.fonte.arial",
  times: "settings.etiquetaEntrega.fonte.times",
  courier: "settings.etiquetaEntrega.fonte.courier",
  georgia: "settings.etiquetaEntrega.fonte.georgia",
  verdana: "settings.etiquetaEntrega.fonte.verdana",
  tahoma: "settings.etiquetaEntrega.fonte.tahoma",
};

export function SeletorFonteTexto({
  fonte,
  onChange,
  ajuda,
}: {
  fonte: FonteImpressao | "";
  onChange: (fonte: FonteImpressao) => void;
  ajuda?: string;
}) {
  const { t } = useI18n();
  return (
    <div>
      <span className="mb-1 block text-[11px] text-slate-600">{t("settings.etiquetaEntrega.tipoFonte")}</span>
      <select
        aria-label={t("settings.etiquetaEntrega.tipoFonte")}
        value={fonte}
        onChange={(e) => onChange(e.target.value as FonteImpressao)}
        className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-[12px] text-slate-800 outline-none"
      >
        {fonte === "" ? <option value="">{t("settings.etiquetaEntrega.fontesMistas")}</option> : null}
        {FONTES_IMPRESSAO.map((item) => (
          <option key={item} value={item}>
            {t(ROTULO_FONTE[item])}
          </option>
        ))}
      </select>
      {ajuda ? <p className="mt-1 text-[10px] leading-snug text-slate-500">{ajuda}</p> : null}
    </div>
  );
}

export function BarraFonteFlutuante({
  visivel,
  fonte,
  onChange,
  negrito,
  sublinhado,
  onNegrito,
  onSublinhado,
}: {
  visivel: boolean;
  fonte: FonteImpressao | "";
  onChange: (fonte: FonteImpressao) => void;
  negrito?: boolean;
  sublinhado?: boolean;
  onNegrito?: () => void;
  onSublinhado?: () => void;
}) {
  const { t } = useI18n();
  if (!visivel) return null;
  return (
    <div className="sticky top-2 z-20 mx-auto mb-2 flex w-fit flex-wrap items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 shadow-md">
      <span className="text-[11px] font-semibold text-slate-700">
        {t("settings.etiquetaEntrega.tipoFonte")}
      </span>
      <select
        aria-label={t("settings.etiquetaEntrega.tipoFonte")}
        value={fonte}
        onChange={(e) => onChange(e.target.value as FonteImpressao)}
        className="h-8 rounded border border-slate-300 bg-white px-2 text-[12px] text-slate-800 outline-none"
      >
        {fonte === "" ? <option value="">{t("settings.etiquetaEntrega.fontesMistas")}</option> : null}
        {FONTES_IMPRESSAO.map((item) => (
          <option key={item} value={item}>
            {t(ROTULO_FONTE[item])}
          </option>
        ))}
      </select>
      {onNegrito ? (
        <button
          type="button"
          aria-pressed={Boolean(negrito)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onNegrito}
          className={`h-8 rounded border px-2 text-[11px] font-bold ${
            negrito ? "border-[#4a90d9] bg-[#4a90d9] text-white" : "border-slate-300 bg-white text-slate-700"
          }`}
        >
          {t("settings.etiquetaEntrega.negrito")}
        </button>
      ) : null}
      {onSublinhado ? (
        <button
          type="button"
          aria-pressed={Boolean(sublinhado)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onSublinhado}
          className={`h-8 rounded border px-2 text-[11px] underline ${
            sublinhado ? "border-[#4a90d9] bg-[#4a90d9] text-white" : "border-slate-300 bg-white text-slate-700"
          }`}
        >
          {t("settings.etiquetaEntrega.sublinhado")}
        </button>
      ) : null}
    </div>
  );
}
