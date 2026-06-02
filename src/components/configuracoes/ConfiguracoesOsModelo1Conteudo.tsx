"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui";
import {
  montarTextosCabecalhoRequisicao,
  normalizarCabecalhoRequisicao,
} from "@/lib/cabecalho-requisicao";
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
import { persistirConfigLaboratorioServidor } from "@/lib/lab-config-sync";
import { configParaLabImpressao, escalaLogoMultiplicador } from "@/lib/lab-logo";
import {
  CAMPOS_MODELO1_CAMPOS,
  CAMPOS_MODELO1_GERAL,
  normalizarOsModelo1Layout,
  PREVIEW_OS_MODELO1,
  type OsModelo1Layout,
} from "@/lib/os-modelo1-layout";
import { cn } from "@/lib/utils";

function CampoNumero({
  label,
  value,
  onChange,
  min = 8,
  max = 24,
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

function LinhaRotuloValor({
  rotulo,
  valor,
  className,
}: {
  rotulo: string;
  valor: string;
  className?: string;
}) {
  return (
    <p className={cn("leading-snug text-slate-800", className)}>
      <span className="font-normal">{rotulo}</span>
      <span className="font-bold"> {valor}</span>
    </p>
  );
}

function PreviewOsModelo1({
  cfg,
  layout,
}: {
  cfg: ConfigLaboratorio;
  layout: OsModelo1Layout;
}) {
  const lab = useMemo(() => configParaLabImpressao(cfg), [cfg]);
  const cab = useMemo(
    () => normalizarCabecalhoRequisicao(cfg.cabecalhoRequisicao),
    [cfg.cabecalhoRequisicao]
  );
  const textos = useMemo(
    () => montarTextosCabecalhoRequisicao(cfg, lab, cab),
    [cfg, lab, cab]
  );
  const escalaLogo = escalaLogoMultiplicador(cfg.logoTamanho);
  const logoW = Math.round(cab.logoTamanhoPx * escalaLogo);
  const logoH = Math.round(logoW * 0.75);
  const amostra = PREVIEW_OS_MODELO1;
  const fs = layout.tamanhoFonte;
  const fsSmall = Math.max(10, fs - 3);
  const fsTiny = Math.max(9, fs - 5);

  const money = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div
      className="mx-auto w-full max-w-[820px] bg-white px-8 py-7 shadow-lg"
      style={{ fontSize: `${fs}px`, fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      <div className="flex gap-4">
        {layout.logo ? (
          <div className="shrink-0">
            {cfg.logoDataUrl?.startsWith("data:image") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cfg.logoDataUrl}
                alt="Logo"
                style={{ width: logoW, height: logoH, objectFit: "contain" }}
              />
            ) : (
              <div
                className="flex items-center justify-center border border-dashed border-slate-300 bg-slate-50 text-slate-400"
                style={{ width: logoW, height: logoH, fontSize: fsTiny }}
              >
                Logo
              </div>
            )}
          </div>
        ) : null}

        {layout.infoLab ? (
          <div className="min-w-0 flex-1">
            <p className="font-bold leading-tight" style={{ fontSize: `${fs + 2}px` }}>
              {textos.nome || "Mateus Bonfim"}
            </p>
            {textos.linhas.map((linha) => (
              <p key={linha} className="mt-0.5 text-slate-700" style={{ fontSize: `${fsSmall}px` }}>
                {linha}
              </p>
            ))}
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <div className="shrink-0 text-right text-slate-800" style={{ fontSize: `${fsSmall}px` }}>
          <p>Ordem de Serviço</p>
          <p className="font-bold leading-none" style={{ fontSize: `${fs + 8}px` }}>
            {amostra.numeroOs}
          </p>
          {layout.dataOs ? (
            <p className="mt-1">
              <span className="font-bold">Data: </span>
              {amostra.dataEntrada}
            </p>
          ) : null}
          <p>
            <span className="font-bold">Status: </span>
            {amostra.status}
          </p>
          {layout.usuario ? (
            <p>
              <span className="font-bold">Usuário: </span>
              {amostra.usuario}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 border-t border-slate-400" />

      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1" style={{ fontSize: `${fsSmall}px` }}>
        <div className="space-y-1">
          {layout.numOs ? (
            <LinhaRotuloValor rotulo="Núm OS:" valor={String(amostra.numeroOs)} />
          ) : null}
          {layout.cliente ? (
            <LinhaRotuloValor rotulo="Cliente:" valor={amostra.cliente} />
          ) : null}
          {layout.dentista ? (
            <LinhaRotuloValor rotulo="Dentista:" valor={amostra.dentista} />
          ) : null}
          {layout.paciente ? (
            <LinhaRotuloValor rotulo="Paciente:" valor={amostra.paciente} />
          ) : null}
        </div>
        <div className="space-y-1">
          {layout.osExterna ? (
            <LinhaRotuloValor rotulo="OS Externa:" valor={amostra.osExterna} />
          ) : null}
          {layout.caixa ? <LinhaRotuloValor rotulo="Caixa:" valor={amostra.caixa} /> : null}
          {layout.clienteTel ? (
            <LinhaRotuloValor rotulo="Telefones:" valor={amostra.telefones} />
          ) : null}
          {layout.clienteEmail ? (
            <LinhaRotuloValor rotulo="Email:" valor={amostra.email} />
          ) : null}
          {layout.clienteEnd ? (
            <LinhaRotuloValor rotulo="Endereço:" valor={amostra.endereco} />
          ) : null}
        </div>
      </div>

      <div className="mt-3 border-t border-slate-400" />

      <table
        className="mt-2 w-full border-collapse"
        style={{ fontSize: `${fsSmall}px` }}
      >
        <thead>
          <tr className="border-b border-slate-400">
            <th className="py-1 text-left font-bold">Qtd</th>
            <th className="py-1 text-left font-bold">Descrição</th>
            {layout.numDente ? (
              <th className="py-1 text-center font-bold">Número Dente</th>
            ) : null}
            {layout.corDente ? <th className="py-1 text-center font-bold">Cor</th> : null}
            {layout.valorUnit ? (
              <th className="py-1 text-right font-bold">Unitário</th>
            ) : null}
            {layout.desconto ? <th className="py-1 text-right font-bold">Desc</th> : null}
            {layout.subtotal ? <th className="py-1 text-right font-bold">Subtotal</th> : null}
          </tr>
        </thead>
        <tbody>
          {amostra.itens.map((item) => (
            <tr key={item.descricao} className="border-b border-slate-300">
              <td className="py-2 align-top">{item.qtd}</td>
              <td className="py-2 align-top">{item.descricao}</td>
              {layout.numDente ? (
                <td className="py-2 text-center align-top">{item.dente}</td>
              ) : null}
              {layout.corDente ? (
                <td className="py-2 text-center align-top">{item.cor}</td>
              ) : null}
              {layout.valorUnit ? (
                <td className="py-2 text-right align-top">{money(item.unitario)}</td>
              ) : null}
              {layout.desconto ? (
                <td className="py-2 text-right align-top">{item.desconto}</td>
              ) : null}
              {layout.subtotal ? (
                <td className="py-2 text-right align-top">{money(item.subtotal)}</td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>

      {layout.dataPrazo ? (
        <p className="mt-2" style={{ fontSize: `${fsSmall}px` }}>
          <span className="font-normal">Prazo: </span>
          <span className="font-bold">{amostra.prazo}</span>
        </p>
      ) : null}
      {layout.finalizado ? (
        <p style={{ fontSize: `${fsSmall}px` }}>
          <span className="font-normal">Finalizado: </span>
          <span className="font-bold">{amostra.finalizado}</span>
        </p>
      ) : null}
      {layout.colaborador ? (
        <p style={{ fontSize: `${fsSmall}px` }}>
          <span className="font-normal">Colaborador: </span>
          <span className="font-bold">{amostra.colaborador}</span>
        </p>
      ) : null}
      {layout.obsServico ? (
        <p className="mt-1" style={{ fontSize: `${fsSmall}px` }}>
          <span className="font-normal">Observação: </span>
          <span className="font-bold">{amostra.obsServico}</span>
        </p>
      ) : null}

      {layout.total ? (
        <>
          <div className="mt-3 border-t border-slate-400" />
          <p className="mt-2 text-right font-bold">Total {money(amostra.total)}</p>
        </>
      ) : null}

      {layout.materialRec ? (
        <p className="mt-3" style={{ fontSize: `${fsSmall}px` }}>
          <span className="font-normal">Materiais: </span>
          <span className="font-bold">{amostra.materiais}</span>
        </p>
      ) : null}
      {layout.obsFicha ? (
        <p style={{ fontSize: `${fsSmall}px` }}>
          <span className="font-normal">Observação: </span>
          <span className="font-bold">{amostra.obsFicha}</span>
        </p>
      ) : null}
      {layout.etapas ? (
        <p className="mt-1" style={{ fontSize: `${fsSmall}px` }}>
          <span className="font-normal">Etapas: </span>
          <span className="font-bold">{amostra.etapas}</span>
        </p>
      ) : null}
      {layout.produtos ? (
        <p className="mt-1 text-slate-500" style={{ fontSize: `${fsTiny}px` }}>
          Produtos vinculados à OS aparecem aqui na impressão.
        </p>
      ) : null}
      {layout.assinatura ? (
        <p className="mt-6 border-t border-slate-300 pt-8 text-center text-slate-500" style={{ fontSize: `${fsTiny}px` }}>
          _________________________________________
          <br />
          Assinatura
        </p>
      ) : null}
      {layout.codBarras ? (
        <div className="mt-4">
          <div className="inline-flex h-8 gap-px bg-black px-1">
            {Array.from({ length: 48 }).map((_, i) => (
              <span
                key={i}
                className="bg-black"
                style={{ width: i % 3 === 0 ? 2 : 1, marginLeft: i % 2 ? 0 : 1 }}
              />
            ))}
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-slate-700">OS{amostra.numeroOs}</p>
        </div>
      ) : null}
    </div>
  );
}

function CheckboxCampo({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[12px] text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-slate-300 accent-[#4a90d9]"
      />
      {label}
    </label>
  );
}

export function ConfiguracoesOsModelo1Conteudo() {
  const [cfg, setCfg] = useState<ConfigLaboratorio | null>(null);
  const [configOs, setConfigOs] = useState<ConfiguracoesOs>(() => carregarConfiguracoesOs());
  const [layout, setLayout] = useState<OsModelo1Layout>(() =>
    normalizarOsModelo1Layout(carregarConfiguracoesOs().layoutModelo1)
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
      setLayout(normalizarOsModelo1Layout(cfgOs.layoutModelo1));
      setCarregando(false);
    })();
    const recarregarLab = () => setCfg(carregarConfigLaboratorio());
    window.addEventListener("lab-config-atualizada", recarregarLab);
    return () => {
      ativo = false;
      window.removeEventListener("lab-config-atualizada", recarregarLab);
    };
  }, []);

  function patchLayout(patch: Partial<OsModelo1Layout>) {
    setLayout((atual) => normalizarOsModelo1Layout({ ...atual, ...patch }));
  }

  async function salvar() {
    setSalvando(true);
    setMensagem("");
    const layoutNorm = normalizarOsModelo1Layout(layout);
    const novaConfig: ConfiguracoesOs = {
      ...configOs,
      layoutModelo1: layoutNorm,
    };
    setConfigOs(novaConfig);
    salvarConfiguracoesOs(novaConfig);
    try {
      await persistirConfiguracoesOsServidor(novaConfig);
      setLayout(layoutNorm);
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

  if (carregando || !cfg) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#4a4f56]">
        <p className="text-sm text-slate-300">Carregando…</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden lg:flex-row">
      <aside className="flex h-full w-full shrink-0 flex-col border-b border-slate-300 bg-[#d9dde3] lg:w-[320px] lg:border-b-0 lg:border-r xl:w-[340px]">
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div>
            <h1 className="text-[15px] font-normal text-slate-800">Modelo 1 - (Produção)</h1>
            <p className="text-[11px] text-slate-600">Ordem de serviço — impressão A4</p>
          </div>

          <div>
            <h2 className="text-[12px] font-semibold text-slate-800">Geral</h2>
            <div className="mt-2 space-y-1.5">
              {CAMPOS_MODELO1_GERAL.map(({ key, label }) => (
                <CheckboxCampo
                  key={key}
                  label={label}
                  checked={Boolean(layout[key])}
                  onChange={(v) => patchLayout({ [key]: v })}
                />
              ))}
            </div>
            <div className="mt-3">
              <CampoNumero
                label="Tamanho da Fonte"
                value={layout.tamanhoFonte}
                onChange={(v) => patchLayout({ tamanhoFonte: v })}
              />
            </div>
          </div>

          <div>
            <h2 className="text-[12px] font-semibold text-slate-800">Campos</h2>
            <div className="mt-2 space-y-1.5">
              {CAMPOS_MODELO1_CAMPOS.map(({ key, label }) => (
                <CheckboxCampo
                  key={key}
                  label={label}
                  checked={Boolean(layout[key])}
                  onChange={(v) => patchLayout({ [key]: v })}
                />
              ))}
            </div>
          </div>

          <div className="rounded border border-slate-300 bg-white/60 p-3">
            <h2 className="text-[12px] font-semibold text-slate-800">Impressão</h2>
            <div className="mt-2 space-y-1.5">
              <CheckboxCampo
                label="Modelo padrão"
                checked={configOs.modeloPadrao === "modelo1"}
                onChange={(v) =>
                  setConfigOs((atual) => ({
                    ...atual,
                    modeloPadrao: v ? "modelo1" : atual.modeloPadrao,
                  }))
                }
              />
              <CheckboxCampo
                label="Duas vias"
                checked={configOs.duasVias.modelo1}
                onChange={(v) =>
                  setConfigOs((atual) => ({
                    ...atual,
                    duasVias: { ...atual.duasVias, modelo1: v },
                  }))
                }
              />
            </div>
          </div>
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
        <div className="flex shrink-0 items-center justify-end gap-2 border-b border-[#3d4248] px-4 py-2.5">
          <Link
            href="/app/configuracoes?aba=os"
            className="rounded bg-[#5a6068] px-5 py-2 text-[12px] text-white hover:bg-[#6a7078]"
          >
            Voltar
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4 md:p-6">
          <PreviewOsModelo1 cfg={cfg} layout={layout} />
        </div>
      </div>
    </div>
  );
}
