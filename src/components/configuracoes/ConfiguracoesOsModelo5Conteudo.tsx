"use client";

import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui";
import {
  carregarConfigLaboratorio,
  type ConfigLaboratorio,
} from "@/lib/configuracoes-lab";
import {
  carregarConfiguracoesOs,
  persistirConfiguracoesOsServidor,
  salvarConfiguracoesOs,
  sincronizarConfiguracoesOsDoServidor,
  type ConfiguracoesOs,
} from "@/lib/configuracoes-os";
import { normalizarCorBorda } from "@/lib/os-modelo1-layout";
import {
  CAMPOS_MODELO5_GERAL,
  CAMPOS_MODELO5_PARES,
  normalizarOsModelo5Layout,
  type OsModelo5Layout,
} from "@/lib/os-modelo5-layout";
import { useI18n } from "@/components/i18n-provider";
import { PreviewOsModelo5Termica } from "@/components/configuracoes/ConfiguracoesOsModelo5Preview";
import { ConfiguracoesOsBarraEditor } from "@/components/configuracoes/ConfiguracoesOsBarraEditor";

function CampoNumero({
  label,
  value,
  onChange,
  min = 0,
  max = 200,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  const { t } = useI18n();
  return (
    <div>
      <span className="mb-1 block text-[11px] text-slate-600">{label}</span>
      <div className="flex overflow-hidden rounded border border-slate-300 bg-white">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center border-r border-slate-200 text-slate-600 hover:bg-slate-50"
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label={t("settings.diminuir", { label })}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || min)}
          className="h-8 w-full min-w-0 border-0 px-2 text-center text-[12px] outline-none"
        />
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center border-l border-slate-200 text-slate-600 hover:bg-slate-50"
          onClick={() => onChange(Math.min(max, value + 1))}
          aria-label={t("settings.aumentar", { label })}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function CheckboxCampo({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-0.5 text-[12px] text-slate-800">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-slate-300 accent-[#5cb85c]"
      />
      {label}
    </label>
  );
}

function GridCheckboxes({
  layout,
  onPatch,
}: {
  layout: OsModelo5Layout;
  onPatch: (patch: Partial<OsModelo5Layout>) => void;
}) {
  return (
    <div className="space-y-1 border-t border-slate-300/80 pt-2">
      {CAMPOS_MODELO5_PARES.map(([esq, dir], indice) => (
        <div key={indice} className="grid grid-cols-2 gap-x-2">
          <CheckboxCampo
            label={esq.label}
            checked={Boolean(layout[esq.key])}
            onChange={(v) => onPatch({ [esq.key]: v })}
          />
          {dir ? (
            <CheckboxCampo
              label={dir.label}
              checked={Boolean(layout[dir.key])}
              onChange={(v) => onPatch({ [dir.key]: v })}
            />
          ) : (
            <span />
          )}
        </div>
      ))}
    </div>
  );
}

export function ConfiguracoesOsModelo5Conteudo() {
  const { t } = useI18n();
  const [cfg, setCfg] = useState<ConfigLaboratorio | null>(null);
  const [configOs, setConfigOs] = useState<ConfiguracoesOs>(() => carregarConfiguracoesOs());
  const [layout, setLayout] = useState<OsModelo5Layout>(() =>
    normalizarOsModelo5Layout(carregarConfiguracoesOs().layoutModelo5)
  );
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      await import("@/lib/lab-config-sync").then((m) =>
        m.sincronizarConfigLaboratorioDoServidor()
      );
      const cfgOs = await sincronizarConfiguracoesOsDoServidor();
      if (!ativo) return;
      setCfg(carregarConfigLaboratorio());
      setConfigOs(cfgOs);
      setLayout(normalizarOsModelo5Layout(cfgOs.layoutModelo5));
      setCarregando(false);
    })();
    const recarregarLab = () => setCfg(carregarConfigLaboratorio());
    window.addEventListener("lab-config-atualizada", recarregarLab);
    return () => {
      ativo = false;
      window.removeEventListener("lab-config-atualizada", recarregarLab);
    };
  }, []);

  function patchLayout(patch: Partial<OsModelo5Layout>) {
    setLayout((atual) => normalizarOsModelo5Layout({ ...atual, ...patch }));
  }

  async function salvar() {
    setSalvando(true);
    setMensagem("");
    const layoutNorm = normalizarOsModelo5Layout(layout);
    const novaConfig: ConfiguracoesOs = {
      ...configOs,
      layoutModelo5: layoutNorm,
    };
    setConfigOs(novaConfig);
    salvarConfiguracoesOs(novaConfig);
    try {
      await persistirConfiguracoesOsServidor(novaConfig);
      setLayout(layoutNorm);
      setMensagem(t("settings.salvoConfigSucesso"));
    } catch {
      setMensagem(t("settings.erroSalvarServidor"));
    } finally {
      setSalvando(false);
      window.setTimeout(() => setMensagem(""), 5000);
    }
  }

  if (carregando || !cfg) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#4a4f56]">
        <p className="text-sm text-slate-300">{t("common.carregando")}</p>
      </div>
    );
  }

  const corLinha = normalizarCorBorda(layout.bordas);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden lg:flex-row">
      <aside className="flex h-full w-full shrink-0 flex-col border-b border-slate-300 bg-[#d9dde3] lg:w-[360px] lg:border-b-0 lg:border-r">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <CampoNumero
            label={t("settings.tamanhoFonte")}
            value={layout.tamanhoFonte}
            onChange={(v) => patchLayout({ tamanhoFonte: v })}
            min={8}
            max={18}
          />

          <CampoNumero
            label={t("settings.tamanhoLogoPx")}
            value={layout.logoTamanhoPx}
            onChange={(v) => patchLayout({ logoTamanhoPx: v })}
            min={40}
            max={200}
          />

          <div>
            <span className="mb-1 block text-[11px] font-semibold text-slate-700">
              {t("settings.corLinhas")}
            </span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={corLinha.length === 7 ? corLinha : "#000000"}
                onChange={(e) => patchLayout({ bordas: e.target.value })}
                className="h-8 w-10 shrink-0 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
                title={t("settings.corLinhasCupom")}
              />
              <input
                type="text"
                value={layout.bordas}
                onChange={(e) => patchLayout({ bordas: e.target.value })}
                placeholder="#000000"
                className="h-8 min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 text-[12px] outline-none focus:border-[#4a90d9]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            {CAMPOS_MODELO5_GERAL.map(({ key, label }) => (
              <CheckboxCampo
                key={key}
                label={label}
                checked={Boolean(layout[key])}
                onChange={(v) => patchLayout({ [key]: v })}
              />
            ))}
          </div>

          <GridCheckboxes layout={layout} onPatch={patchLayout} />

          <div className="grid grid-cols-2 gap-x-2 border-t border-slate-300/80 pt-2">
            <CheckboxCampo
              label={t("settings.modeloPadrao")}
              checked={configOs.modeloPadrao === "modelo5"}
              onChange={(v) =>
                setConfigOs((atual) => ({
                  ...atual,
                  modeloPadrao: v ? "modelo5" : atual.modeloPadrao,
                }))
              }
            />
            <CheckboxCampo
              label={t("settings.duasViasCheckbox")}
              checked={configOs.duasVias.modelo5}
              onChange={(v) =>
                setConfigOs((atual) => ({
                  ...atual,
                  duasVias: { ...atual.duasVias, modelo5: v },
                }))
              }
            />
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-300 bg-[#d9dde3] p-4">
          <Button
            type="button"
            onClick={() => void salvar()}
            disabled={salvando}
            className="w-full rounded bg-[#5cb85c] py-2.5 text-sm font-normal text-white hover:bg-[#4cae4c]"
          >
            {salvando ? t("common.gravando") : t("settings.salvarAlteracoes")}
          </Button>
        </div>
      </aside>

      <div className="flex min-h-0 flex-1 flex-col bg-[#4a4f56]">
        {mensagem ? (
          <div className="shrink-0 bg-[#5cb85c] px-4 py-2.5 text-center text-[13px] font-medium text-white">
            {mensagem}
          </div>
        ) : null}
        <ConfiguracoesOsBarraEditor modeloAtivo="modelo5" />
        <div className="min-h-0 flex-1 overflow-auto p-6">
          <PreviewOsModelo5Termica cfg={cfg} layout={layout} />
        </div>
      </div>
    </div>
  );
}
