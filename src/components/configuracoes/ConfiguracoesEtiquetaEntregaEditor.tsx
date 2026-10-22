"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bold, Minus, Plus, Square, Underline } from "lucide-react";
import { Button } from "@/components/ui";
import { useI18n } from "@/components/i18n-provider";
import type { MessageKey } from "@/lib/i18n/messages";
import {
  CAMPOS_TEXTO_ETIQUETA_ENTREGA,
  ETIQUETA_ENTREGA_ESPACAMENTO_MAX,
  ETIQUETA_ENTREGA_ESPACAMENTO_MIN,
  MODELOS_ETIQUETA_ENTREGA,
  ROTAS_ETIQUETA_ENTREGA,
  carregarConfiguracoesEtiquetaEntrega,
  modeloEtiquetaEntregaPorId,
  normalizarLayoutEtiquetaEntrega,
  persistirConfiguracoesEtiquetaEntregaServidor,
  salvarConfiguracoesEtiquetaEntrega,
  sincronizarConfiguracoesEtiquetaEntregaDoServidor,
  type CampoTextoEtiquetaEntrega,
  type ConfiguracoesEtiquetaEntrega,
  type EstiloTextoEtiquetaEntrega,
  type LayoutEtiquetaEntrega,
  type ModeloEtiquetaEntregaId,
} from "@/lib/configuracoes-etiqueta-entrega";
import { htmlEtiquetaEnvio, remetenteDoLaboratorio } from "@/lib/etiqueta-envio-entrega";

function CampoNumero({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (valor: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div>
      <span className="mb-1 block text-[11px] text-slate-600">{label}</span>
      <div className="flex overflow-hidden rounded border border-slate-300 bg-white">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center border-r border-slate-200 text-slate-600 hover:bg-slate-50"
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))}
          className="h-8 w-full min-w-0 border-0 px-2 text-center text-[12px] outline-none"
        />
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center border-l border-slate-200 text-slate-600 hover:bg-slate-50"
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

const ROTULO_CAMPO_TEXTO: Record<CampoTextoEtiquetaEntrega, MessageKey> = {
  os: "settings.etiquetaEntrega.campo.os",
  tituloDestinatario: "settings.etiquetaEntrega.campo.tituloDestinatario",
  nomeDestinatario: "settings.etiquetaEntrega.campo.nomeDestinatario",
  enderecoDestinatario: "settings.etiquetaEntrega.campo.enderecoDestinatario",
  tituloRemetente: "settings.etiquetaEntrega.campo.tituloRemetente",
  nomeRemetente: "settings.etiquetaEntrega.campo.nomeRemetente",
  enderecoRemetente: "settings.etiquetaEntrega.campo.enderecoRemetente",
};

function CheckboxCampo({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (valor: boolean) => void;
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

export function ConfiguracoesEtiquetaEntregaEditor({
  modelo,
}: {
  modelo: ModeloEtiquetaEntregaId;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const definicao = modeloEtiquetaEntregaPorId(modelo);
  const [config, setConfig] = useState<ConfiguracoesEtiquetaEntrega>(() =>
    carregarConfiguracoesEtiquetaEntrega()
  );
  const [layout, setLayout] = useState<LayoutEtiquetaEntrega>(() =>
    normalizarLayoutEtiquetaEntrega(carregarConfiguracoesEtiquetaEntrega().layouts[modelo])
  );
  const [campoTexto, setCampoTexto] = useState<CampoTextoEtiquetaEntrega>("nomeDestinatario");
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    void sincronizarConfiguracoesEtiquetaEntregaDoServidor().then((cfg) => {
      if (!ativo) return;
      setConfig(cfg);
      setLayout(normalizarLayoutEtiquetaEntrega(cfg.layouts[modelo]));
      setCarregando(false);
    });
    return () => {
      ativo = false;
    };
  }, [modelo]);

  const preview = useMemo(() => {
    return htmlEtiquetaEnvio({
      textos: {
        titulo: t("producao.entregas.etiqueta.titulo"),
        destinatario: t("producao.entregas.etiqueta.destinatario"),
        remetente: t("producao.entregas.etiqueta.remetente"),
        os: t("producao.controle.tabela.os"),
        cep: t("producao.entregas.etiqueta.cep"),
        remetenteSemCadastro: t("producao.entregas.etiqueta.remetenteSemCadastro"),
        imprimir: t("producao.comum.imprimir"),
        fechar: t("common.fechar"),
      },
      destinatario: {
        nome: "João Piski",
        rua: "Rua das Flores",
        numero: "48",
        bairro: "Centro",
        complemento: "Loja",
        cidade: "São Domingos do Norte",
        uf: "ES",
        cep: "29745-000",
      },
      remetente: remetenteDoLaboratorio(),
      numeroOs: "123, 119, 68",
      opcoes: {
        formato: definicao.formato,
        modeloA4: definicao.modeloA4,
        layout,
        preview: true,
        campoDestacado: campoTexto,
      },
    });
  }, [campoTexto, definicao.formato, definicao.modeloA4, layout, t]);

  function patch(parcial: Partial<LayoutEtiquetaEntrega>) {
    setLayout((atual) => normalizarLayoutEtiquetaEntrega({ ...atual, ...parcial }));
  }

  function patchEstilo(parcial: Partial<EstiloTextoEtiquetaEntrega>) {
    setLayout((atual) =>
      normalizarLayoutEtiquetaEntrega({
        ...atual,
        estilosTexto: {
          ...atual.estilosTexto,
          [campoTexto]: { ...atual.estilosTexto[campoTexto], ...parcial },
        },
      })
    );
  }

  async function salvar() {
    setSalvando(true);
    setMensagem("");
    const layoutNorm = normalizarLayoutEtiquetaEntrega(layout);
    const nova: ConfiguracoesEtiquetaEntrega = {
      ...config,
      layouts: { ...config.layouts, [modelo]: layoutNorm },
    };
    setConfig(nova);
    setLayout(layoutNorm);
    salvarConfiguracoesEtiquetaEntrega(nova);
    try {
      await persistirConfiguracoesEtiquetaEntregaServidor(nova);
      setMensagem(t("settings.salvoConfigSucesso"));
    } catch {
      setMensagem(t("settings.erroSalvarServidor"));
    } finally {
      setSalvando(false);
      window.setTimeout(() => setMensagem(""), 5000);
    }
  }

  if (carregando) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-[#4a4f56]">
        <p className="text-sm text-slate-300">{t("common.carregando")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden lg:flex-row">
      <aside className="flex h-full w-full shrink-0 flex-col border-b border-slate-300 bg-[#d9dde3] lg:w-[360px] lg:border-b-0 lg:border-r">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <CampoNumero
            label={t("settings.tamanhoFonte")}
            value={layout.tamanhoFonte}
            min={10}
            max={22}
            onChange={(valor) => patch({ tamanhoFonte: valor })}
          />
          <CampoNumero
            label={t("settings.espacamento")}
            value={layout.espacamento}
            min={ETIQUETA_ENTREGA_ESPACAMENTO_MIN}
            max={ETIQUETA_ENTREGA_ESPACAMENTO_MAX}
            onChange={(valor) => patch({ espacamento: valor })}
          />
          <p className="-mt-1 text-[10px] leading-snug text-slate-500">
            {t("settings.etiquetaEntrega.espacamentoAjuda")}
          </p>
          <div>
            <span className="mb-1 block text-[11px] text-slate-600">
              {t("settings.etiquetaEntrega.texto")}
            </span>
            <select
              value={campoTexto}
              onChange={(e) => setCampoTexto(e.target.value as CampoTextoEtiquetaEntrega)}
              className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-[12px] text-slate-800 outline-none"
            >
              {CAMPOS_TEXTO_ETIQUETA_ENTREGA.map((campo) => (
                <option key={campo} value={campo}>
                  {t(ROTULO_CAMPO_TEXTO[campo])}
                </option>
              ))}
            </select>
            <div className="mt-2 grid grid-cols-3 gap-1">
              <button
                type="button"
                aria-pressed={layout.estilosTexto[campoTexto].negrito}
                title={t("settings.etiquetaEntrega.negrito")}
                onClick={() => patchEstilo({ negrito: !layout.estilosTexto[campoTexto].negrito })}
                className={`inline-flex min-h-8 flex-col items-center justify-center gap-0.5 rounded border px-1 py-1 text-[10px] leading-tight ${
                  layout.estilosTexto[campoTexto].negrito
                    ? "border-[#4a90d9] bg-[#4a90d9] text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Bold className="h-3.5 w-3.5" />
                {t("settings.etiquetaEntrega.negrito")}
              </button>
              <button
                type="button"
                aria-pressed={layout.estilosTexto[campoTexto].sublinhado}
                title={t("settings.etiquetaEntrega.sublinhado")}
                onClick={() =>
                  patchEstilo({ sublinhado: !layout.estilosTexto[campoTexto].sublinhado })
                }
                className={`inline-flex min-h-8 flex-col items-center justify-center gap-0.5 rounded border px-1 py-1 text-[10px] leading-tight ${
                  layout.estilosTexto[campoTexto].sublinhado
                    ? "border-[#4a90d9] bg-[#4a90d9] text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Underline className="h-3.5 w-3.5" />
                {t("settings.etiquetaEntrega.sublinhado")}
              </button>
              <button
                type="button"
                aria-pressed={layout.estilosTexto[campoTexto].borda}
                title={t("settings.etiquetaEntrega.bordaTexto")}
                onClick={() => patchEstilo({ borda: !layout.estilosTexto[campoTexto].borda })}
                className={`inline-flex min-h-8 flex-col items-center justify-center gap-0.5 rounded border px-1 py-1 text-[10px] leading-tight ${
                  layout.estilosTexto[campoTexto].borda
                    ? "border-[#4a90d9] bg-[#4a90d9] text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Square className="h-3.5 w-3.5" />
                {t("settings.etiquetaEntrega.bordaTexto")}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 border-t border-slate-300/80 pt-2">
            <CheckboxCampo
              label={t("settings.etiquetaEntrega.exibirOs")}
              checked={layout.exibirOs}
              onChange={(valor) => patch({ exibirOs: valor })}
            />
            <CheckboxCampo
              label={t("settings.etiquetaEntrega.exibirDestinatario")}
              checked={layout.exibirDestinatario}
              onChange={(valor) => patch({ exibirDestinatario: valor })}
            />
            <CheckboxCampo
              label={t("settings.etiquetaEntrega.exibirRemetente")}
              checked={layout.exibirRemetente}
              onChange={(valor) => patch({ exibirRemetente: valor })}
            />
            <CheckboxCampo
              label={t("settings.etiquetaEntrega.exibirCep")}
              checked={layout.exibirCep}
              onChange={(valor) => patch({ exibirCep: valor })}
            />
            <CheckboxCampo
              label={t("settings.etiquetaEntrega.exibirTelefone")}
              checked={layout.exibirTelefone}
              onChange={(valor) => patch({ exibirTelefone: valor })}
            />
            <CheckboxCampo
              label={t("settings.etiquetaEntrega.exibirBorda")}
              checked={layout.exibirBorda}
              onChange={(valor) => patch({ exibirBorda: valor })}
            />
          </div>
          <div className="grid grid-cols-2 gap-x-2 border-t border-slate-300/80 pt-2">
            <CheckboxCampo
              label={t("settings.modeloPadrao")}
              checked={config.modeloPadrao === modelo}
              onChange={(valor) =>
                setConfig((atual) => ({
                  ...atual,
                  modeloPadrao: valor ? modelo : atual.modeloPadrao,
                }))
              }
            />
            <CheckboxCampo
              label={t("settings.duasViasCheckbox")}
              checked={config.duasVias[modelo]}
              onChange={(valor) =>
                setConfig((atual) => ({
                  ...atual,
                  duasVias: { ...atual.duasVias, [modelo]: valor },
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
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#4a4f56]">
        {mensagem ? (
          <div className="shrink-0 bg-[#5cb85c] px-4 py-2.5 text-center text-[13px] font-medium text-white">
            {mensagem}
          </div>
        ) : null}
        <div className="flex shrink-0 items-center justify-end gap-2 border-b border-[#3d4248] bg-[#4a4f56] px-4 py-2.5">
          <select
            value={modelo}
            onChange={(e) => {
              const id = e.target.value as ModeloEtiquetaEntregaId;
              if (id !== modelo) router.push(ROTAS_ETIQUETA_ENTREGA[id]);
            }}
            className="max-w-[min(100%,28rem)] rounded border border-[#5a6068] bg-white px-3 py-2 text-[12px] text-slate-800 outline-none"
            aria-label={t("settings.etiquetasEntrega")}
          >
            {MODELOS_ETIQUETA_ENTREGA.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>
          <Link
            href="/app/configuracoes?aba=etiquetasEntrega"
            className="shrink-0 rounded bg-[#5a6068] px-5 py-2 text-[12px] text-white hover:bg-[#6a7078]"
          >
            {t("settings.voltar")}
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <iframe
            title={definicao.nome}
            srcDoc={preview}
            className="mx-auto block h-[1100px] w-full max-w-[900px] border-0 bg-white"
          />
        </div>
      </div>
    </div>
  );
}
