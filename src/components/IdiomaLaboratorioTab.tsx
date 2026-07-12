"use client";

import { Save } from "lucide-react";
import { Button } from "@/components/ui";
import type { TipoMensagemForm } from "@/components/DadosLaboratorioForm";
import { useI18n } from "@/components/i18n-provider";
import type { ConfigLaboratorio } from "@/lib/configuracoes-lab";
import { normalizarIdioma, type Locale } from "@/lib/i18n";
import { persistirIdiomaLocal } from "@/lib/idioma-ui";

type Props = {
  form: ConfigLaboratorio;
  onChange: (patch: Partial<ConfigLaboratorio>) => void;
  onSalvar: () => void;
  salvando?: boolean;
  mensagem?: string;
  mensagemTipo?: TipoMensagemForm;
};

const selectClass =
  "h-9 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9] dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-primary-500 dark:focus:ring-primary-500";

export function IdiomaLaboratorioTab({
  form,
  onChange,
  onSalvar,
  salvando = false,
  mensagem = "",
  mensagemTipo = "info",
}: Props) {
  const { t } = useI18n();
  const idioma = normalizarIdioma(form.idioma);

  function aoMudarIdioma(novo: Locale) {
    persistirIdiomaLocal(novo);
    const patch: Partial<ConfigLaboratorio> = { idioma: novo };
    if (novo === "en") {
      patch.pais = patch.pais || "Estados Unidos";
      patch.moeda = patch.moeda || "Dólar";
      patch.codigoPaisTelefone = patch.codigoPaisTelefone || "+1";
    } else if (novo === "es") {
      patch.pais = patch.pais || "España";
      patch.moeda = patch.moeda || "Euro";
      patch.codigoPaisTelefone = patch.codigoPaisTelefone || "+34";
    } else {
      patch.pais = patch.pais || "Brasil";
      patch.moeda = patch.moeda || "Real";
      patch.codigoPaisTelefone = patch.codigoPaisTelefone || "+55";
    }
    onChange(patch);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSalvar();
      }}
      className="mx-auto max-w-3xl"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
            {t("idioma.labelIdioma")}
          </label>
          <select
            className={selectClass}
            value={idioma}
            onChange={(e) => aoMudarIdioma(normalizarIdioma(e.target.value))}
          >
            <option value="pt">{t("idioma.opcaoPt")}</option>
            <option value="en">{t("idioma.opcaoEn")}</option>
            <option value="es">{t("idioma.opcaoEs")}</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
            {t("idioma.labelPais")}
          </label>
          <select
            className={selectClass}
            value={form.pais || "Brasil"}
            onChange={(e) => onChange({ pais: e.target.value })}
          >
            <option value="Brasil">{t("idioma.paisBrasil")}</option>
            <option value="Estados Unidos">{t("idioma.paisEua")}</option>
            <option value="España">{t("idioma.paisEspanha")}</option>
            <option value="México">{t("idioma.paisMexico")}</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
            {t("idioma.labelMoeda")}
          </label>
          <select
            className={selectClass}
            value={form.moeda || "Real"}
            onChange={(e) => onChange({ moeda: e.target.value })}
          >
            <option value="Real">{t("idioma.moedaReal")}</option>
            <option value="Dólar">{t("idioma.moedaDolar")}</option>
            <option value="Euro">{t("idioma.moedaEuro")}</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
            {t("idioma.labelCodigoTelefone")}
          </label>
          <select
            className={selectClass}
            value={form.codigoPaisTelefone || "+55"}
            onChange={(e) => onChange({ codigoPaisTelefone: e.target.value })}
          >
            <option value="+55">+55</option>
            <option value="+1">+1</option>
            <option value="+34">+34</option>
            <option value="+52">+52</option>
          </select>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-end gap-3">
        {mensagem ? (
          <span
            role="alert"
            className={`mr-auto text-sm font-medium ${
              mensagemTipo === "sucesso"
                ? "text-emerald-600"
                : mensagemTipo === "erro"
                  ? "text-red-600"
                  : "text-slate-600"
            }`}
          >
            {mensagem}
          </span>
        ) : null}
        <Button
          type="submit"
          disabled={salvando}
          className="inline-flex items-center gap-2 rounded bg-[#4a90d9] px-5 py-2 text-sm font-normal text-white hover:bg-[#3d7fc4]"
        >
          <Save className="h-4 w-4" />
          {salvando ? t("common.gravando") : t("common.gravar")}
        </Button>
      </div>
    </form>
  );
}
