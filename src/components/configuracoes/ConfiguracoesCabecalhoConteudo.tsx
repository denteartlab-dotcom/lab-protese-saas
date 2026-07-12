"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui";
import { useI18n } from "@/components/i18n-provider";
import {
  montarTextosCabecalhoRequisicao,
  normalizarCabecalhoRequisicao,
  type CabecalhoRequisicaoConfig,
} from "@/lib/cabecalho-requisicao";
import {
  carregarConfigLaboratorio,
  salvarConfigLaboratorio,
  type ConfigLaboratorio,
} from "@/lib/configuracoes-lab";
import { persistirConfigLaboratorioServidor } from "@/lib/lab-config-sync";
import { configParaLabImpressao, escalaLogoMultiplicador } from "@/lib/lab-logo";
import { cn } from "@/lib/utils";

function CampoNumero({
  label,
  value,
  onChange,
  min = 0,
  max = 240,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const { t } = useI18n();
  return (
    <div>
      <span className="mb-1 block text-[11px] text-slate-600">{label}</span>
      <div className="flex overflow-hidden rounded border border-slate-300 bg-white">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center border-r border-slate-200 text-slate-600 hover:bg-slate-50"
          onClick={() => onChange(Math.max(min, value - step))}
          aria-label={t("settings.diminuir", { label })}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="h-8 w-full min-w-0 border-0 px-2 text-center text-[12px] outline-none"
        />
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center border-l border-slate-200 text-slate-600 hover:bg-slate-50"
          onClick={() => onChange(Math.min(max, value + step))}
          aria-label={t("settings.aumentar", { label })}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function PreviewCabecalho({
  cfg,
  cab,
}: {
  cfg: ConfigLaboratorio;
  cab: CabecalhoRequisicaoConfig;
}) {
  const { t } = useI18n();
  const lab = useMemo(() => configParaLabImpressao(cfg), [cfg]);
  const textos = useMemo(
    () => montarTextosCabecalhoRequisicao(cfg, lab, cab),
    [cfg, lab, cab]
  );
  const escalaLogo = escalaLogoMultiplicador(cfg.logoTamanho);
  const logoW = Math.round(cab.logoTamanhoPx * escalaLogo);
  const logoH = Math.round(logoW * 0.75);

  return (
    <div className="relative w-full bg-white px-10 py-8" style={{ minHeight: "100%" }}>
      <div className="flex items-center gap-4">
        <div
          className="flex shrink-0 items-center self-center"
          style={{
            marginLeft: cab.logoMargemEsquerda,
            marginTop: cab.logoMargemTopo,
          }}
        >
          {cfg.logoDataUrl?.startsWith("data:image") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cfg.logoDataUrl}
              alt={t("settings.logo")}
              style={{ width: logoW, height: logoH, objectFit: "contain" }}
            />
          ) : (
            <div
              className="flex items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-slate-400"
              style={{ width: logoW, height: logoH }}
            >
              <span className="text-[10px]">{t("settings.logo")}</span>
            </div>
          )}
        </div>
        <div
          className="min-w-0 flex-1"
          style={{
            marginLeft: cab.infoMargemEsquerda,
            marginTop: cab.infoMargemTopo,
          }}
        >
          <p
            className="font-bold leading-tight text-slate-900"
            style={{ fontSize: cab.fonteNomePt }}
          >
            {textos.nome || t("settings.nomeLabPlaceholder")}
          </p>
          {textos.linhas.map((linha) => (
            <p
              key={linha}
              className="mt-0.5 text-slate-700"
              style={{ fontSize: cab.fonteInfoPt }}
            >
              {linha}
            </p>
          ))}
        </div>
        <div className="shrink-0 text-right text-slate-800">
          <p className="text-[13px] font-normal">{t("print.os.titulo")}</p>
          <p className="mt-1 text-[22px] font-bold leading-none">194</p>
          <p className="mt-2 text-[11px]">
            <span className="font-bold">{t("print.os.data")}: </span>
            <span className="font-normal">19/08/2021 08:35</span>
          </p>
          <p className="text-[11px]">
            <span className="font-bold">{t("print.os.status")}: </span>
            <span className="font-normal">{t("settings.emProducao")}</span>
          </p>
          <p className="text-[11px]">
            <span className="font-bold">{t("print.os.usuario")}: </span>
            <span className="font-normal">Fernando</span>
          </p>
        </div>
      </div>
      <div className="mt-4 border-t border-slate-300" />
    </div>
  );
}

export function ConfiguracoesCabecalhoConteudo() {
  const { t } = useI18n();
  const [cfg, setCfg] = useState<ConfigLaboratorio | null>(null);
  const [cab, setCab] = useState<CabecalhoRequisicaoConfig>(
    normalizarCabecalhoRequisicao()
  );
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    void import("@/lib/lab-config-sync").then((m) =>
      m.sincronizarConfigLaboratorioDoServidor()
    );
    const carregar = () => {
      const carregado = carregarConfigLaboratorio();
      setCfg(carregado);
      setCab(normalizarCabecalhoRequisicao(carregado.cabecalhoRequisicao));
    };
    carregar();
    window.addEventListener("lab-config-atualizada", carregar);
    return () => window.removeEventListener("lab-config-atualizada", carregar);
  }, []);

  function patchCab(patch: Partial<CabecalhoRequisicaoConfig>) {
    setCab((atual) => normalizarCabecalhoRequisicao({ ...atual, ...patch }));
  }

  async function salvar() {
    if (!cfg) return;
    setSalvando(true);
    setMensagem("");
    const merged = {
      ...cfg,
      cabecalhoRequisicao: normalizarCabecalhoRequisicao(cab),
      logoDataUrl: "",
    };
    try {
      await persistirConfigLaboratorioServidor(merged);
      salvarConfigLaboratorio(merged);
      const gravado = carregarConfigLaboratorio();
      setCfg(gravado);
      setMensagem(t("settings.salvoSucesso"));
    } catch {
      setMensagem(t("settings.erroSalvarServidor"));
    } finally {
      setSalvando(false);
      window.setTimeout(() => setMensagem(""), 5000);
    }
  }

  if (!cfg) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#4a4f56]">
        <p className="text-sm text-slate-300">{t("common.carregando")}</p>
      </div>
    );
  }

  const camposInfo = [
    ["exibirEndereco", "settings.endereco"],
    ["exibirCelular", "settings.celular"],
    ["exibirEmail", "settings.email"],
    ["exibirTelComercial", "settings.telComercial"],
    ["exibirSite", "settings.paginaWeb"],
  ] as const;

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden lg:flex-row">
      <aside className="flex h-full w-full shrink-0 flex-col border-b border-slate-300 bg-[#d9dde3] lg:w-[360px] lg:border-b-0 lg:border-r">
        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <div>
            <h1 className="text-[15px] font-normal text-slate-800">{t("settings.cabecalho")}</h1>
            <p className="text-[11px] text-slate-600">{t("settings.cabecalhoSubtitulo")}</p>
          </div>
          <div>
            <h2 className="text-[13px] font-semibold text-slate-800">{t("settings.logo")}</h2>
            <div className="mt-2 grid grid-cols-1 gap-3">
              <CampoNumero
                label={t("settings.tamanhoPx")}
                value={cab.logoTamanhoPx}
                onChange={(v) => patchCab({ logoTamanhoPx: v })}
                min={40}
                max={240}
              />
              <div className="grid grid-cols-2 gap-2">
                <CampoNumero
                  label={t("settings.margemEsquerda")}
                  value={cab.logoMargemEsquerda}
                  onChange={(v) => patchCab({ logoMargemEsquerda: v })}
                  max={120}
                />
                <CampoNumero
                  label={t("settings.margemTopo")}
                  value={cab.logoMargemTopo}
                  onChange={(v) => patchCab({ logoMargemTopo: v })}
                  max={80}
                />
              </div>
            </div>
            <p className="mt-2 text-[10px] text-slate-500">{t("settings.cabecalhoLogoDica")}</p>
          </div>

          <div>
            <h2 className="text-[13px] font-semibold text-slate-800">
              {t("settings.cabecalhoInfoLab")}
            </h2>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <CampoNumero
                label={t("settings.margemEsquerda")}
                value={cab.infoMargemEsquerda}
                onChange={(v) => patchCab({ infoMargemEsquerda: v })}
                max={120}
              />
              <CampoNumero
                label={t("settings.margemTopo")}
                value={cab.infoMargemTopo}
                onChange={(v) => patchCab({ infoMargemTopo: v })}
                max={80}
              />
              <CampoNumero
                label={t("settings.tamFonteNome")}
                value={cab.fonteNomePt}
                onChange={(v) => patchCab({ fonteNomePt: v })}
                min={10}
                max={32}
              />
              <CampoNumero
                label={t("settings.tamFonteInfo")}
                value={cab.fonteInfoPt}
                onChange={(v) => patchCab({ fonteInfoPt: v })}
                min={8}
                max={24}
              />
            </div>
            <div className="mt-3 space-y-1.5 text-[12px] text-slate-700">
              {camposInfo.map(([key, labelKey]) => (
                <label key={key} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={cab[key]}
                    onChange={(e) => patchCab({ [key]: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-slate-300 accent-[#4a90d9]"
                  />
                  {t(labelKey)}
                </label>
              ))}
            </div>
            <label className="mt-3 block text-[11px] text-slate-600">
              {t("settings.infoAdicionais")}
              <textarea
                value={cab.informacoesAdicionais}
                onChange={(e) => patchCab({ informacoesAdicionais: e.target.value })}
                rows={3}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-[12px] outline-none focus:border-[#4a90d9]"
                placeholder={t("settings.infoAdicionaisPlaceholder")}
              />
            </label>
            <p className="mt-2 text-[10px] text-slate-500">{t("settings.cabecalhoDadosDica")}</p>
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
          {mensagem ? (
            <p
              className={cn(
                "mt-2 text-center text-[11px]",
                mensagem === t("settings.salvoSucesso") ? "text-emerald-700" : "text-amber-800"
              )}
            >
              {mensagem}
            </p>
          ) : null}
        </div>
      </aside>

      <div className="flex min-h-0 flex-1 flex-col bg-[#4a4f56]">
        <div className="flex shrink-0 items-center justify-end gap-2 border-b border-[#3d4248] bg-[#4a4f56] px-4 py-2.5">
          <Link
            href="/app/configuracoes?aba=dados"
            className="rounded bg-[#5a6068] px-5 py-2 text-[12px] text-white hover:bg-[#6a7078]"
          >
            {t("settings.voltar")}
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4 md:p-6">
          <PreviewCabecalho cfg={cfg} cab={cab} />
        </div>
      </div>
    </div>
  );
}
