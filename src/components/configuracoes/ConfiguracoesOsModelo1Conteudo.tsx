"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui";
import { Code39Barcode } from "@/lib/code39-barcode";
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
  type ModeloOsId,
} from "@/lib/configuracoes-os";
import { configParaLabImpressao, escalaLogoMultiplicador } from "@/lib/lab-logo";
import {
  CAMPOS_MODELO1_GERAL,
  CAMPOS_MODELO1_PARES,
  estiloAteBordaPreview,
  estiloLinhaDivisoriaAteBordaPreview,
  estiloLinhaInferiorRequisicaoPreview,
  estiloLinhaRequisicaoPreview,
  estiloMolduraOverlayRequisicaoPreview,
  estiloPaginaRequisicaoPreview,
  estiloWrapperConteudoRequisicaoPreview,
  gapRequisicaoPreviewMm,
  normalizarCorBorda,
  normalizarOsModelo1Layout,
  OS_REQUISICAO_ESPACAMENTO_MAX,
  OS_REQUISICAO_ESPACAMENTO_MIN,
  PREVIEW_OS_MODELO1,
  type OsModelo1Layout,
} from "@/lib/os-modelo1-layout";
import {
  CAMPOS_MODELO2_PARES,
  normalizarOsModelo2Layout,
  PREVIEW_OS_MODELO2,
} from "@/lib/os-modelo2-layout";
import {
  CAMPOS_MODELO3_GERAL,
  CAMPOS_MODELO3_PARES,
  normalizarOsModelo3Layout,
  PREVIEW_OS_MODELO3,
} from "@/lib/os-modelo3-layout";
import { PreviewOsModeloComprovante } from "@/components/configuracoes/ConfiguracoesOsModeloComprovantePreview";
import { cn } from "@/lib/utils";

type CampoPar = Array<
  [{ key: keyof OsModelo1Layout; label: string }, { key: keyof OsModelo1Layout; label: string } | null]
>;

type PreviewAmostra = typeof PREVIEW_OS_MODELO1 & {
  producao?: string;
  pecas?: string;
};

export type ModeloProducaoEditorConfig = {
  tituloBarra: string;
  modeloId: Extract<ModeloOsId, "modelo1" | "modelo2" | "modelo3">;
  layoutKey: "layoutModelo1" | "layoutModelo2" | "layoutModelo3";
  tipoPreview: "producao" | "comprovante";
  camposGeral: Array<{ key: keyof OsModelo1Layout; label: string }>;
  camposPares: CampoPar;
  amostraPreview: PreviewAmostra;
  normalizarLayout: (valor?: Partial<OsModelo1Layout> | null) => OsModelo1Layout;
  lerLayout: (config: ConfiguracoesOs) => OsModelo1Layout;
};

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
    <p className={cn("leading-snug text-slate-900", className)}>
      <span>{rotulo}</span>
      <span className="font-bold"> {valor}</span>
    </p>
  );
}

function LinhaSeparador({
  layout,
  className,
  marginTop,
}: {
  layout: OsModelo1Layout;
  className?: string;
  marginTop?: string;
}) {
  return (
    <div
      className={cn(className)}
      style={{
        ...estiloLinhaDivisoriaAteBordaPreview(layout),
        ...(marginTop ? { marginTop } : undefined),
      }}
    />
  );
}

function PreviewOsModeloProducao({
  cfg,
  layout,
  amostra,
}: {
  cfg: ConfigLaboratorio;
  layout: OsModelo1Layout;
  amostra: PreviewAmostra;
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
  const fs = layout.tamanhoFonte;
  const fsSmall = Math.max(10, fs - 4);
  const gap = (mm: number) => gapRequisicaoPreviewMm(layout, mm);

  const money = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div
      className="mx-auto bg-white text-slate-900 shadow-md"
      style={{
        width: "210mm",
        minHeight: "297mm",
        maxWidth: "100%",
        ...estiloPaginaRequisicaoPreview(),
        fontSize: `${fs}px`,
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div style={estiloWrapperConteudoRequisicaoPreview()}>
        <div aria-hidden style={estiloMolduraOverlayRequisicaoPreview(layout)} />
      <div className="flex items-start gap-3">
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
                className="flex items-center justify-center border border-dashed border-slate-300 bg-slate-100 text-slate-400"
                style={{ width: logoW, height: logoH, fontSize: 10 }}
              >
                Logo
              </div>
            )}
          </div>
        ) : null}

        {layout.infoLab ? (
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="font-bold leading-tight" style={{ fontSize: `${fs + 1}px` }}>
              {textos.nome || "Mateus Bonfim"}
            </p>
            {textos.linhas.map((linha) => (
              <p key={linha} className="leading-snug" style={{ fontSize: `${fsSmall}px` }}>
                {linha}
              </p>
            ))}
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <div className="shrink-0 text-right" style={{ fontSize: `${fsSmall}px` }}>
          <p className="font-normal">Ordem de Serviço</p>
          <p className="font-bold leading-none" style={{ fontSize: `${fs + 10}px` }}>
            {amostra.numeroOs}
          </p>
          {layout.dataOs ? (
            <p className="mt-1">
              <span className="font-bold">Data: </span>
              {amostra.dataEntrada}
            </p>
          ) : null}
          {layout.usuario ? (
            <p>
              <span className="font-bold">Usuário: </span>
              {amostra.usuario}
            </p>
          ) : null}
        </div>
      </div>

      <LinhaSeparador layout={layout} marginTop={gap(2)} />

      <div
        className="grid grid-cols-2 gap-x-8"
        style={{
          fontSize: `${fsSmall}px`,
          marginTop: gap(2),
          rowGap: gap(0.5),
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: gap(0.5) }}>
          {layout.numOs ? (
            <LinhaRotuloValor rotulo="Num. OS:" valor={String(amostra.numeroOs)} />
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
        <div style={{ display: "flex", flexDirection: "column", gap: gap(0.5) }}>
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

      <LinhaSeparador layout={layout} marginTop={gap(2)} />

      <div style={{ marginTop: gap(2), ...estiloAteBordaPreview(layout) }}>
      <table
        className="w-full border-collapse"
        style={{ fontSize: `${fsSmall}px` }}
      >
        <thead>
          <tr style={estiloLinhaInferiorRequisicaoPreview()}>
            <th className="py-0.5 pr-2 text-left font-bold">Qtd</th>
            <th className="py-0.5 pr-2 text-left font-bold">Descrição</th>
            {layout.numDente ? (
              <th className="py-1 px-1 text-center font-bold">Número Dente</th>
            ) : null}
            {layout.corDente ? <th className="py-1 px-1 text-center font-bold">Cor</th> : null}
            {layout.valorUnit ? (
              <th className="py-1 px-1 text-right font-bold">Unitário</th>
            ) : null}
            {layout.desconto ? <th className="py-1 pl-1 text-right font-bold">Desc</th> : null}
            {layout.subtotal ? <th className="py-1 pl-1 text-right font-bold">Subtotal</th> : null}
          </tr>
        </thead>
        <tbody>
          {amostra.itens.map((item, indice) => (
            <tr
              key={item.descricao}
              style={
                indice < amostra.itens.length - 1 || !layout.total
                  ? estiloLinhaInferiorRequisicaoPreview()
                  : undefined
              }
            >
              <td className="py-0.5 pr-2 align-top">{item.qtd}</td>
              <td className="py-0.5 pr-2 align-top">{item.descricao}</td>
              {layout.numDente ? (
                <td className="px-1 py-1.5 text-center align-top">{item.dente}</td>
              ) : null}
              {layout.corDente ? (
                <td className="px-1 py-1.5 text-center align-top">{item.cor}</td>
              ) : null}
              {layout.valorUnit ? (
                <td className="px-1 py-1.5 text-right align-top">{money(item.unitario)}</td>
              ) : null}
              {layout.desconto ? (
                <td className="py-1.5 pl-1 text-right align-top">{item.desconto}</td>
              ) : null}
              {layout.subtotal ? (
                <td className="py-1.5 pl-1 text-right align-top">{money(item.subtotal)}</td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <div style={{ fontSize: `${fsSmall}px`, marginTop: gap(2), display: "flex", flexDirection: "column", gap: gap(0.5) }}>
        {layout.dataPrazo || layout.finalizado ? (
          <p>
            {layout.dataPrazo ? (
              <>
                <span>Prazo: </span>
                <span className="font-bold">{amostra.prazo}</span>
              </>
            ) : null}
            {layout.dataPrazo && layout.finalizado ? (
              <span className="mx-1 font-normal">|</span>
            ) : null}
            {layout.finalizado ? (
              <>
                <span>Finalizado: </span>
                <span className="font-bold">{amostra.finalizado}</span>
              </>
            ) : null}
          </p>
        ) : null}
        {layout.colaborador ? (
          <p>
            <span>Colaborador: </span>
            <span className="font-bold">{amostra.colaborador}</span>
          </p>
        ) : null}
        {layout.producao && amostra.producao ? (
          <p>
            <span>Produção: </span>
            <span className="font-bold">{amostra.producao}</span>
          </p>
        ) : null}
        {layout.obsServico ? (
          <p>
            <span>Observação: </span>
            <span className="font-bold">{amostra.obsServico}</span>
          </p>
        ) : null}
      </div>

      {layout.total ? (
        <>
          <LinhaSeparador layout={layout} marginTop={gap(2)} />
          <p className="text-right font-bold" style={{ marginTop: gap(1.5) }}>
            Total {money(amostra.total)}
          </p>
        </>
      ) : null}

      {layout.materialRec ? (
        <p style={{ fontSize: `${fsSmall}px`, marginTop: gap(2) }}>
          <span>Materiais: </span>
          <span className="font-bold">{amostra.materiais}</span>
        </p>
      ) : null}
      {layout.obsFicha ? (
        <p style={{ fontSize: `${fsSmall}px` }}>
          <span>Observação: </span>
          <span className="font-bold">{amostra.obsFicha}</span>
        </p>
      ) : null}
      {layout.etapas ? (
        <p style={{ fontSize: `${fsSmall}px` }}>
          <span>Etapas: </span>
          <span className="font-bold">{amostra.etapas}</span>
        </p>
      ) : null}
      {layout.pecas && amostra.pecas ? (
        <p style={{ fontSize: `${fsSmall}px` }}>
          <span>Peças: </span>
          <span className="font-bold">{amostra.pecas}</span>
        </p>
      ) : null}
      {layout.mensagem.trim() ? (
        <p className="italic text-slate-700" style={{ fontSize: `${fsSmall}px`, marginTop: gap(2) }}>
          {layout.mensagem}
        </p>
      ) : null}

      {layout.assinatura ? (
        <div className="text-center" style={{ fontSize: `${fsSmall - 1}px`, marginTop: gap(6), ...estiloAteBordaPreview(layout) }}>
          <div className="mx-auto w-48" style={estiloLinhaRequisicaoPreview()} />
          <p className="text-slate-600" style={{ marginTop: gap(1) }}>
            Assinatura
          </p>
        </div>
      ) : null}

      {layout.codBarras ? (
        <div style={{ marginTop: gap(4) }}>
          <Code39Barcode value={`OS${amostra.numeroOs}`} height={36} />
          <p className="font-mono text-[9px] tracking-wide text-slate-800" style={{ marginTop: gap(0.5) }}>
            OS{amostra.numeroOs}
          </p>
          <LinhaSeparador layout={layout} marginTop={gap(2)} />
        </div>
      ) : null}
      </div>
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
    <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-800">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 shrink-0 rounded border-slate-400 accent-[#4a90d9]"
      />
      <span className="leading-tight">{label}</span>
    </label>
  );
}

function GridCheckboxes({
  layout,
  onPatch,
  camposPares,
}: {
  layout: OsModelo1Layout;
  onPatch: (patch: Partial<OsModelo1Layout>) => void;
  camposPares: CampoPar;
}) {
  return (
    <div className="space-y-1">
      {camposPares.map(([esq, dir], idx) => (
        <div key={idx} className="grid grid-cols-2 gap-x-2">
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

export function ConfiguracoesOsModeloProducaoConteudo({
  editor,
}: {
  editor: ModeloProducaoEditorConfig;
}) {
  const [cfg, setCfg] = useState<ConfigLaboratorio | null>(null);
  const [configOs, setConfigOs] = useState<ConfiguracoesOs>(() => carregarConfiguracoesOs());
  const [layout, setLayout] = useState<OsModelo1Layout>(() =>
    editor.normalizarLayout(editor.lerLayout(carregarConfiguracoesOs()))
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
      setLayout(editor.normalizarLayout(editor.lerLayout(cfgOs)));
      setCarregando(false);
    })();
    const recarregarLab = () => setCfg(carregarConfigLaboratorio());
    window.addEventListener("lab-config-atualizada", recarregarLab);
    return () => {
      ativo = false;
      window.removeEventListener("lab-config-atualizada", recarregarLab);
    };
  }, [editor]);

  function patchLayout(patch: Partial<OsModelo1Layout>) {
    setLayout((atual) => editor.normalizarLayout({ ...atual, ...patch }));
  }

  async function salvar() {
    setSalvando(true);
    setMensagem("");
    const layoutNorm = editor.normalizarLayout(layout);
    const novaConfig: ConfiguracoesOs = {
      ...configOs,
      [editor.layoutKey]: layoutNorm,
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

  const corBorda = normalizarCorBorda(layout.bordas);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden lg:flex-row">
      <aside className="flex h-full w-full shrink-0 flex-col border-b border-slate-300 bg-[#d9dde3] lg:w-[360px] lg:border-b-0 lg:border-r">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
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
                onChange={(e) => patchLayout({ bordas: e.target.value, exibirBordas: true })}
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

          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            {editor.camposGeral.map(({ key, label }) => (
              <CheckboxCampo
                key={key}
                label={label}
                checked={Boolean(layout[key])}
                onChange={(v) => patchLayout({ [key]: v })}
              />
            ))}
          </div>

          <CampoNumero
            label="Tamanho da Fonte"
            value={layout.tamanhoFonte}
            onChange={(v) => patchLayout({ tamanhoFonte: v })}
          />

          <CampoNumero
            label="Espaçamento"
            value={layout.espacamentoRequisicao}
            min={OS_REQUISICAO_ESPACAMENTO_MIN}
            max={OS_REQUISICAO_ESPACAMENTO_MAX}
            onChange={(v) => patchLayout({ espacamentoRequisicao: v })}
          />

          <GridCheckboxes layout={layout} onPatch={patchLayout} camposPares={editor.camposPares} />

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-700">Mensagem</span>
            <textarea
              value={layout.mensagem}
              onChange={(e) => patchLayout({ mensagem: e.target.value })}
              rows={3}
              className="w-full resize-y rounded border border-slate-300 bg-white px-2 py-1.5 text-[12px] outline-none focus:border-[#4a90d9]"
              placeholder="Texto opcional no rodapé da requisição"
            />
          </label>

          <div className="grid grid-cols-2 gap-x-2 border-t border-slate-300/80 pt-2">
            <CheckboxCampo
              label="Modelo padrão"
              checked={configOs.modeloPadrao === editor.modeloId}
              onChange={(v) =>
                setConfigOs((atual) => ({
                  ...atual,
                  modeloPadrao: v ? editor.modeloId : atual.modeloPadrao,
                }))
              }
            />
            <CheckboxCampo
              label="Duas vias"
              checked={configOs.duasVias[editor.modeloId]}
              onChange={(v) =>
                setConfigOs((atual) => ({
                  ...atual,
                  duasVias: { ...atual.duasVias, [editor.modeloId]: v },
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
            {editor.tituloBarra}
          </span>
          <Link
            href="/app/configuracoes?aba=os"
            className="rounded bg-[#5a6068] px-5 py-2 text-[12px] text-white hover:bg-[#6a7078]"
          >
            Voltar
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-6">
          {editor.tipoPreview === "comprovante" ? (
            <PreviewOsModeloComprovante cfg={cfg} layout={layout} />
          ) : (
            <PreviewOsModeloProducao cfg={cfg} layout={layout} amostra={editor.amostraPreview} />
          )}
        </div>
      </div>
    </div>
  );
}

const EDITOR_MODELO1: ModeloProducaoEditorConfig = {
  tituloBarra: "Modelo 1 - (Produção)",
  modeloId: "modelo1",
  layoutKey: "layoutModelo1",
  tipoPreview: "producao",
  camposGeral: CAMPOS_MODELO1_GERAL,
  camposPares: CAMPOS_MODELO1_PARES,
  amostraPreview: PREVIEW_OS_MODELO1,
  normalizarLayout: normalizarOsModelo1Layout,
  lerLayout: (config) => config.layoutModelo1,
};

const EDITOR_MODELO2: ModeloProducaoEditorConfig = {
  tituloBarra: "Modelo 2 - (Produção)",
  modeloId: "modelo2",
  layoutKey: "layoutModelo2",
  tipoPreview: "producao",
  camposGeral: CAMPOS_MODELO1_GERAL,
  camposPares: CAMPOS_MODELO2_PARES,
  amostraPreview: PREVIEW_OS_MODELO2,
  normalizarLayout: normalizarOsModelo2Layout,
  lerLayout: (config) => config.layoutModelo2,
};

const EDITOR_MODELO3: ModeloProducaoEditorConfig = {
  tituloBarra: "Modelo 3 - (Comprovante de Entrega)",
  modeloId: "modelo3",
  layoutKey: "layoutModelo3",
  tipoPreview: "comprovante",
  camposGeral: CAMPOS_MODELO3_GERAL,
  camposPares: CAMPOS_MODELO3_PARES,
  amostraPreview: PREVIEW_OS_MODELO3,
  normalizarLayout: normalizarOsModelo3Layout,
  lerLayout: (config) => config.layoutModelo3,
};

export function ConfiguracoesOsModelo1Conteudo() {
  return <ConfiguracoesOsModeloProducaoConteudo editor={EDITOR_MODELO1} />;
}

export function ConfiguracoesOsModelo2Conteudo() {
  return <ConfiguracoesOsModeloProducaoConteudo editor={EDITOR_MODELO2} />;
}

export function ConfiguracoesOsModelo3Conteudo() {
  return <ConfiguracoesOsModeloProducaoConteudo editor={EDITOR_MODELO3} />;
}
