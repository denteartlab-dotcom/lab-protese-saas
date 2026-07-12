"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";
import { ConfiguracoesFaturaModeloPreview } from "@/components/configuracoes/ConfiguracoesFaturaModeloPreview";
import {
  carregarConfigLaboratorio,
  type ConfigLaboratorio,
} from "@/lib/configuracoes-lab";
import {
  aplicarLayoutFaturaModelo,
  formatoPorModeloFatura,
  MODELOS_FATURA,
  normalizarLayoutFaturaTermica,
  persistirConfiguracoesFaturasServidor,
  resolverLayoutFaturaImpressao,
  salvarConfiguracoesFaturas,
  sincronizarConfiguracoesFaturasDoServidor,
  type ConfiguracoesFaturas,
  type ModeloFaturaId,
} from "@/lib/configuracoes-faturas";
import {
  CAMPOS_FATURA_CABECALHO,
  CAMPOS_FATURA_PARES,
  CAMPOS_FATURA_TERMICA_CABECALHO,
  CAMPOS_FATURA_TERMICA_PARES,
  normalizarFaturaModeloLayout,
  type FaturaModeloLayout,
} from "@/lib/fatura-modelo-layout";
import { normalizarCorBorda } from "@/lib/os-modelo1-layout";

type Props = {
  modeloId: ModeloFaturaId;
};

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
  return (
    <div>
      <span className="mb-1 block text-[11px] text-slate-600">{label}</span>
      <div className="flex overflow-hidden rounded border border-slate-300 bg-white">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center border-r border-slate-200 text-slate-600 hover:bg-slate-50"
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label={`Diminuir ${label}`}
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
          aria-label={`Aumentar ${label}`}
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

function PixQrConfiguracao({
  layout,
  patchLayout,
}: {
  layout: FaturaModeloLayout;
  patchLayout: (patch: Partial<FaturaModeloLayout>) => void;
}) {
  const { t } = useI18n();
  if (!layout.pix) return null;

  function escolherImagem(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 500_000) {
      window.alert(t("settings.imagemGrande", { kb: 500 }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === "string" ? reader.result : "";
      patchLayout({ pixQrImagem: url });
    };
    reader.readAsDataURL(file);
  }

  const previewPx = Math.min(layout.pixQrTamanhoPx, 120);

  return (
    <div className="space-y-2 rounded border border-slate-300/80 bg-white/60 p-3">
      <span className="block text-[11px] font-semibold text-slate-700">{t("settings.pixQrTitulo")}</span>
      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded border border-slate-300 bg-white px-3 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50">
          {t("settings.escolherImagem")}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              escolherImagem(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {layout.pixQrImagem ? (
          <button
            type="button"
            className="text-[11px] text-red-600 hover:underline"
            onClick={() => patchLayout({ pixQrImagem: "" })}
          >
            {t("settings.remover")}
          </button>
        ) : null}
      </div>
      {layout.pixQrImagem?.startsWith("data:image") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={layout.pixQrImagem}
          alt={t("settings.pixQrTitulo")}
          className="border border-slate-200 bg-white"
          style={{
            width: previewPx,
            height: previewPx,
            objectFit: "contain",
          }}
        />
      ) : (
        <p className="text-[10px] text-slate-500">{t("settings.nenhumaImagem")}</p>
      )}
      <CampoNumero
        label={t("settings.tamanhoImagemPx")}
        value={layout.pixQrTamanhoPx}
        onChange={(v) => patchLayout({ pixQrTamanhoPx: v })}
        min={32}
        max={240}
      />
      <CampoNumero
        label={t("settings.tamanhoFonteLegenda")}
        value={layout.pixQrFonte}
        onChange={(v) => patchLayout({ pixQrFonte: v })}
        min={7}
        max={20}
      />
    </div>
  );
}

export function ConfiguracoesFaturaModeloConteudo({ modeloId }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [cfg, setCfg] = useState<ConfigLaboratorio | null>(null);
  const [config, setConfig] = useState<ConfiguracoesFaturas | null>(null);
  const [layout, setLayout] = useState<FaturaModeloLayout | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [menuEdicaoAberto, setMenuEdicaoAberto] = useState(true);

  const modeloValido = MODELOS_FATURA.some((m) => m.id === modeloId);
  const termica = formatoPorModeloFatura(modeloId) === "termica";

  useEffect(() => {
    let ativo = true;
    void (async () => {
      await import("@/lib/lab-config-sync").then((m) =>
        m.sincronizarConfigLaboratorioDoServidor()
      );
      const cfgFaturas = await sincronizarConfiguracoesFaturasDoServidor();
      if (!ativo) return;
      setCfg(carregarConfigLaboratorio());
      setConfig(cfgFaturas);
      setLayout(resolverLayoutFaturaImpressao(cfgFaturas, modeloId));
      setCarregando(false);
    })();
    const recarregarLab = () => setCfg(carregarConfigLaboratorio());
    window.addEventListener("lab-config-atualizada", recarregarLab);
    return () => {
      ativo = false;
      window.removeEventListener("lab-config-atualizada", recarregarLab);
    };
  }, [modeloId]);

  const alteracoesPendentes = useMemo(() => {
    if (!config || !layout) return false;
    const salvo = resolverLayoutFaturaImpressao(config, modeloId);
    const editado = resolverLayoutFaturaImpressao(config, modeloId, layout);
    return JSON.stringify(salvo) !== JSON.stringify(editado);
  }, [config, layout, modeloId]);

  function patchLayout(patch: Partial<FaturaModeloLayout>) {
    setLayout((atual) =>
      atual
        ? termica
          ? normalizarLayoutFaturaTermica(modeloId, { ...atual, ...patch })
          : normalizarFaturaModeloLayout({ ...atual, ...patch })
        : atual
    );
  }

  function trocarModelo(id: ModeloFaturaId) {
    if (id === modeloId) return;
    setCarregando(true);
    router.replace(`/app/configuracoes/faturas/${id}`);
  }

  async function salvar() {
    if (!config || !layout) return;
    setSalvando(true);
    setMensagem("");
    const layoutNorm = resolverLayoutFaturaImpressao(config, modeloId, layout);
    const novaConfig: ConfiguracoesFaturas = aplicarLayoutFaturaModelo(
      config,
      modeloId,
      layoutNorm
    );
    setConfig(novaConfig);
    setLayout(layoutNorm);
    salvarConfiguracoesFaturas(novaConfig);
    try {
      await persistirConfiguracoesFaturasServidor(novaConfig);
      setMensagem(t("settings.salvoConfigSucesso"));
    } catch {
      setMensagem(t("settings.erroSalvarServidor"));
    } finally {
      setSalvando(false);
      window.setTimeout(() => setMensagem(""), 5000);
    }
  }

  const barraSuperior = (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#3d4248] bg-[#4a4f56] px-4 py-2.5">
      <button
        type="button"
        onClick={() => setMenuEdicaoAberto((aberto) => !aberto)}
        className={cn(
          "inline-flex items-center gap-2 rounded px-3 py-2 text-[12px] text-white transition-colors",
          menuEdicaoAberto ? "bg-[#5a6068]" : "bg-[#5cb85c] hover:bg-[#4cae4c]"
        )}
      >
        <Settings className="h-4 w-4" />
        {t("settings.personalizar")}
      </button>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <select
          value={modeloId}
          onChange={(e) => trocarModelo(e.target.value as ModeloFaturaId)}
          className="max-w-full truncate rounded border border-[#5a6068] bg-white px-3 py-2 text-[12px] text-slate-800 outline-none focus:border-[#4a90d9]"
          aria-label={t("settings.selecionarModeloFatura")}
        >
          {MODELOS_FATURA.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
        <Link
          href="/app/configuracoes?aba=faturas"
          className="shrink-0 rounded bg-[#5a6068] px-5 py-2 text-[12px] text-white hover:bg-[#6a7078]"
        >
          {t("settings.voltar")}
        </Link>
      </div>
    </header>
  );

  if (!modeloValido) {
    return (
      <div className="flex h-screen w-full flex-col overflow-hidden lg:flex-row">
        <div className="flex min-h-0 flex-1 flex-col">
          {barraSuperior}
          <p className="p-6 text-sm text-slate-600">
            {t("settings.modeloNaoEncontrado")}{" "}
            <Link href="/app/configuracoes?aba=faturas" className="text-[#4a90d9] hover:underline">
              {t("settings.voltarFaturas")}
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (carregando || !cfg || !config || !layout) {
    return (
      <div className="flex h-screen w-full flex-col overflow-hidden lg:flex-row">
        <div className="flex min-h-0 flex-1 flex-col">
          {barraSuperior}
          <div className="flex min-h-0 flex-1 items-center justify-center bg-[#e8eaed]">
            <p className="text-sm text-slate-500">{t("common.carregando")}</p>
          </div>
        </div>
      </div>
    );
  }

  const corBorda = normalizarCorBorda(layout.bordas);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden lg:flex-row">
      <aside
        className={cn(
          "flex h-full w-full shrink-0 flex-col border-b border-slate-300 bg-[#d9dde3] lg:w-[360px] lg:border-b-0 lg:border-r",
          !menuEdicaoAberto && "hidden"
        )}
      >
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {!termica ? (
            <>
              <div>
                <span className="mb-1 block text-[11px] font-semibold text-slate-700">
                  {t("settings.cabecalho")}
                </span>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                  {CAMPOS_FATURA_CABECALHO.map(({ key, label }) => (
                    <CheckboxCampo
                      key={key}
                      label={label}
                      checked={Boolean(layout[key])}
                      onChange={(v) => patchLayout({ [key]: v })}
                    />
                  ))}
                </div>
              </div>

              <CampoNumero
                label={t("settings.tamanhoFonte")}
                value={layout.tamanhoFonte}
                onChange={(v) => patchLayout({ tamanhoFonte: v })}
                min={8}
                max={20}
              />

              <div className="space-y-1">
                {CAMPOS_FATURA_PARES.map(([esq, dir], indice) => (
                  <div key={indice} className="grid grid-cols-2 gap-x-2">
                    <CheckboxCampo
                      label={esq.label}
                      checked={Boolean(layout[esq.key])}
                      onChange={(v) => patchLayout({ [esq.key]: v })}
                    />
                    {dir ? (
                      <CheckboxCampo
                        label={dir.label}
                        checked={Boolean(layout[dir.key])}
                        onChange={(v) => patchLayout({ [dir.key]: v })}
                      />
                    ) : (
                      <span />
                    )}
                  </div>
                ))}
              </div>

              <PixQrConfiguracao layout={layout} patchLayout={patchLayout} />

              <div>
                <span className="mb-1 block text-[11px] font-semibold text-slate-700">
                  {t("settings.mensagens")}
                </span>
                <textarea
                  value={layout.mensagem}
                  onChange={(e) => patchLayout({ mensagem: e.target.value })}
                  rows={3}
                  placeholder={t("settings.mensagemFatura")}
                  className="w-full resize-y rounded border border-slate-300 bg-white px-2 py-1.5 text-[12px] outline-none focus:border-[#4a90d9]"
                />
              </div>

              <div>
                <span className="mb-1 block text-[11px] font-semibold text-slate-700">
                  {t("settings.bordas")}
                  <span className="ml-1 font-normal text-slate-500">{t("settings.bordasCorMoldura")}</span>
                </span>
                <div className="flex items-center gap-2">
                  <CheckboxCampo
                    label={t("settings.bordas")}
                    checked={layout.exibirBordas}
                    onChange={(v) => patchLayout({ exibirBordas: v })}
                  />
                  <input
                    type="color"
                    value={corBorda.length === 7 ? corBorda : "#bdbdbd"}
                    onChange={(e) => patchLayout({ bordas: e.target.value })}
                    disabled={!layout.exibirBordas}
                    className="h-8 w-10 shrink-0 cursor-pointer rounded border border-slate-300 bg-white p-0.5 disabled:cursor-not-allowed disabled:opacity-40"
                    title={t("settings.corBordaPagina")}
                  />
                  <input
                    type="text"
                    value={layout.bordas}
                    onChange={(e) => patchLayout({ bordas: e.target.value })}
                    disabled={!layout.exibirBordas}
                    placeholder="#bdbdbd"
                    className="h-8 min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 text-[12px] outline-none focus:border-[#4a90d9] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <span className="mb-1 block text-[11px] font-semibold text-slate-700">
                  {t("settings.cabecalho")}
                </span>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                  {CAMPOS_FATURA_TERMICA_CABECALHO.map(({ key, label }) => (
                    <CheckboxCampo
                      key={key}
                      label={label}
                      checked={Boolean(layout[key])}
                      onChange={(v) => patchLayout({ [key]: v })}
                    />
                  ))}
                </div>
              </div>

              <CampoNumero
                label={t("settings.tamanhoLogoPx")}
                value={layout.logoTamanhoPx}
                onChange={(v) => patchLayout({ logoTamanhoPx: v })}
                min={40}
                max={200}
              />
              <div className="grid grid-cols-2 gap-2">
                <CampoNumero
                  label={t("settings.logoMargemEsq")}
                  value={layout.logoMargemEsq}
                  onChange={(v) => patchLayout({ logoMargemEsq: v })}
                  max={40}
                />
                <CampoNumero
                  label={t("settings.logoMargemTopo")}
                  value={layout.logoMargemTopo}
                  onChange={(v) => patchLayout({ logoMargemTopo: v })}
                  max={40}
                />
              </div>
              <CampoNumero
                label={t("settings.tamanhoFonte")}
                value={layout.tamanhoFonte}
                onChange={(v) => patchLayout({ tamanhoFonte: v })}
                min={8}
                max={18}
              />
              <div className="space-y-1 border-t border-slate-300/80 pt-2">
                {CAMPOS_FATURA_TERMICA_PARES.map(([esq, dir], indice) => (
                  <div key={indice} className="grid grid-cols-2 gap-x-2">
                    <CheckboxCampo
                      label={esq.label}
                      checked={Boolean(layout[esq.key])}
                      onChange={(v) => patchLayout({ [esq.key]: v })}
                    />
                    {dir ? (
                      <CheckboxCampo
                        label={dir.label}
                        checked={Boolean(layout[dir.key])}
                        onChange={(v) => patchLayout({ [dir.key]: v })}
                      />
                    ) : (
                      <span />
                    )}
                  </div>
                ))}
              </div>

              <PixQrConfiguracao layout={layout} patchLayout={patchLayout} />

              <div>
                <span className="mb-1 block text-[11px] font-semibold text-slate-700">
                  {t("settings.mensagem")}
                </span>
                <textarea
                  value={layout.mensagem}
                  onChange={(e) => patchLayout({ mensagem: e.target.value })}
                  rows={3}
                  placeholder={t("settings.mensagemFatura")}
                  className="w-full resize-y rounded border border-slate-300 bg-white px-2 py-1.5 text-[12px] outline-none focus:border-[#4a90d9]"
                />
              </div>
            </>
          )}
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

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {mensagem ? (
          <div className="shrink-0 bg-[#5cb85c] px-4 py-2.5 text-center text-[13px] font-medium text-white">
            {mensagem}
          </div>
        ) : null}
        {alteracoesPendentes ? (
          <div className="shrink-0 bg-amber-500 px-4 py-2.5 text-center text-[12px] font-medium text-white">
            {t("settings.alteracoesPendentes")}
          </div>
        ) : null}
        {barraSuperior}
        <div className="min-h-0 flex-1 overflow-auto bg-[#e8eaed] p-6">
          <ConfiguracoesFaturaModeloPreview
            cfg={cfg}
            layout={layout}
            modeloId={modeloId}
            termica={termica}
          />
        </div>
      </div>
    </div>
  );
}
