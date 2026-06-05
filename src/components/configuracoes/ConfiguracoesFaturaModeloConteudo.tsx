"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui";
import { ConfiguracoesFaturaModeloPreview } from "@/components/configuracoes/ConfiguracoesFaturaModeloPreview";
import {
  carregarConfigLaboratorio,
  type ConfigLaboratorio,
} from "@/lib/configuracoes-lab";
import {
  formatoPorModeloFatura,
  layoutKeyModeloFatura,
  lerLayoutModeloFatura,
  MODELOS_FATURA,
  nomeModeloFatura,
  persistirConfiguracoesFaturasServidor,
  salvarConfiguracoesFaturas,
  sincronizarConfiguracoesFaturasDoServidor,
  type ConfiguracoesFaturas,
  type ModeloFaturaId,
} from "@/lib/configuracoes-faturas";
import {
  CAMPOS_FATURA_CABECALHO,
  CAMPOS_FATURA_PARES,
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
  if (!layout.pix) return null;

  function escolherImagem(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 500_000) {
      window.alert("Imagem muito grande. Use um arquivo de até 500 KB.");
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
      <span className="block text-[11px] font-semibold text-slate-700">PIX — QR Code</span>
      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded border border-slate-300 bg-white px-3 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50">
          Escolher imagem
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
            Remover
          </button>
        ) : null}
      </div>
      {layout.pixQrImagem?.startsWith("data:image") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={layout.pixQrImagem}
          alt="Prévia QR PIX"
          className="border border-slate-200 bg-white"
          style={{
            width: previewPx,
            height: previewPx,
            objectFit: "contain",
          }}
        />
      ) : (
        <p className="text-[10px] text-slate-500">Nenhuma imagem selecionada.</p>
      )}
      <CampoNumero
        label="Tamanho da imagem (px)"
        value={layout.pixQrTamanhoPx}
        onChange={(v) => patchLayout({ pixQrTamanhoPx: v })}
        min={32}
        max={240}
      />
      <CampoNumero
        label="Tamanho da fonte (legenda)"
        value={layout.pixQrFonte}
        onChange={(v) => patchLayout({ pixQrFonte: v })}
        min={7}
        max={20}
      />
    </div>
  );
}

export function ConfiguracoesFaturaModeloConteudo({ modeloId }: Props) {
  const [cfg, setCfg] = useState<ConfigLaboratorio | null>(null);
  const [config, setConfig] = useState<ConfiguracoesFaturas | null>(null);
  const [layout, setLayout] = useState<FaturaModeloLayout | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(true);

  const modeloValido = MODELOS_FATURA.some((m) => m.id === modeloId);
  const termica = formatoPorModeloFatura(modeloId) === "termica";
  const layoutKey = layoutKeyModeloFatura(modeloId);
  const nomeModelo = nomeModeloFatura(modeloId);

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
      setLayout(normalizarFaturaModeloLayout(lerLayoutModeloFatura(cfgFaturas, modeloId)));
      setCarregando(false);
    })();
    const recarregarLab = () => setCfg(carregarConfigLaboratorio());
    window.addEventListener("lab-config-atualizada", recarregarLab);
    return () => {
      ativo = false;
      window.removeEventListener("lab-config-atualizada", recarregarLab);
    };
  }, [modeloId]);

  function patchLayout(patch: Partial<FaturaModeloLayout>) {
    setLayout((atual) => (atual ? normalizarFaturaModeloLayout({ ...atual, ...patch }) : atual));
  }

  async function salvar() {
    if (!config || !layout) return;
    setSalvando(true);
    setMensagem("");
    const layoutNorm = normalizarFaturaModeloLayout(layout);
    const novaConfig: ConfiguracoesFaturas = {
      ...config,
      [layoutKey]: layoutNorm,
    };
    setConfig(novaConfig);
    setLayout(layoutNorm);
    salvarConfiguracoesFaturas(novaConfig);
    try {
      await persistirConfiguracoesFaturasServidor(novaConfig);
      setMensagem("Configuração salva com sucesso.");
    } catch {
      setMensagem(
        "Salvo neste navegador, mas não foi possível gravar no servidor. Tente novamente."
      );
    } finally {
      setSalvando(false);
      window.setTimeout(() => setMensagem(""), 5000);
    }
  }

  if (!modeloValido) {
    return (
      <p className="p-6 text-sm text-slate-600">
        Modelo não encontrado.{" "}
        <Link href="/app/configuracoes?aba=faturas" className="text-[#4a90d9] hover:underline">
          Voltar para Faturas
        </Link>
      </p>
    );
  }

  if (carregando || !cfg || !config || !layout) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#4a4f56]">
        <p className="text-sm text-slate-300">Carregando…</p>
      </div>
    );
  }

  const corBorda = normalizarCorBorda(layout.bordas);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden lg:flex-row">
      <aside className="flex h-full w-full shrink-0 flex-col border-b border-slate-300 bg-[#d9dde3] lg:w-[360px] lg:border-b-0 lg:border-r">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {!termica ? (
            <>
              <div>
                <span className="mb-1 block text-[11px] font-semibold text-slate-700">
                  Cabeçalho
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
                label="Tamanho da Fonte"
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
                  Mensagens
                </span>
                <textarea
                  value={layout.mensagem}
                  onChange={(e) => patchLayout({ mensagem: e.target.value })}
                  rows={3}
                  placeholder="Texto opcional exibido na fatura"
                  className="w-full resize-y rounded border border-slate-300 bg-white px-2 py-1.5 text-[12px] outline-none focus:border-[#4a90d9]"
                />
              </div>

              <div>
                <span className="mb-1 block text-[11px] font-semibold text-slate-700">
                  Bordas
                  <span className="ml-1 font-normal text-slate-500">(cor só da moldura)</span>
                </span>
                <div className="flex items-center gap-2">
                  <CheckboxCampo
                    label="Bordas"
                    checked={layout.exibirBordas}
                    onChange={(v) => patchLayout({ exibirBordas: v })}
                  />
                  <input
                    type="color"
                    value={corBorda.length === 7 ? corBorda : "#bdbdbd"}
                    onChange={(e) => patchLayout({ bordas: e.target.value })}
                    disabled={!layout.exibirBordas}
                    className="h-8 w-10 shrink-0 cursor-pointer rounded border border-slate-300 bg-white p-0.5 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Cor da borda da página"
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
              <CampoNumero
                label="Tamanho da Logo (px)"
                value={layout.logoTamanhoPx}
                onChange={(v) => patchLayout({ logoTamanhoPx: v })}
                min={40}
                max={160}
              />
              <div className="grid grid-cols-2 gap-2">
                <CampoNumero
                  label="Logo Margem Esq"
                  value={layout.logoMargemEsq}
                  onChange={(v) => patchLayout({ logoMargemEsq: v })}
                  max={40}
                />
                <CampoNumero
                  label="Logo Margem Topo"
                  value={layout.logoMargemTopo}
                  onChange={(v) => patchLayout({ logoMargemTopo: v })}
                  max={40}
                />
              </div>
              <CampoNumero
                label="Tamanho da Fonte"
                value={layout.tamanhoFonte}
                onChange={(v) => patchLayout({ tamanhoFonte: v })}
                min={7}
                max={14}
              />
              <div className="space-y-1 border-t border-slate-300/80 pt-2">
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
            {salvando ? "Salvando…" : "Salvar Alterações"}
          </Button>
        </div>
      </aside>

      <div className="flex min-h-0 flex-1 flex-col bg-[#4a4f56]">
        {mensagem ? (
          <div className="shrink-0 bg-[#5cb85c] px-4 py-2.5 text-center text-[13px] font-medium text-white">
            {mensagem}
          </div>
        ) : null}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#3d4248] bg-[#4a4f56] px-4 py-2.5">
          <span className="rounded border border-[#5a6068] bg-[#5a6068] px-3 py-1.5 text-[12px] text-white">
            {nomeModelo}
          </span>
          <Link
            href="/app/configuracoes?aba=faturas"
            className="rounded bg-[#5a6068] px-5 py-2 text-[12px] text-white hover:bg-[#6a7078]"
          >
            Voltar
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-6">
          <ConfiguracoesFaturaModeloPreview cfg={cfg} layout={layout} termica={termica} />
        </div>
      </div>
    </div>
  );
}
