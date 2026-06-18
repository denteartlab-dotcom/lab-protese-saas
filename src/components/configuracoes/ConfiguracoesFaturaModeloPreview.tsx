"use client";

import { useMemo } from "react";
import type { ConfigLaboratorio } from "@/lib/configuracoes-lab";
import {
  CONFIG_FATURAS_PADRAO,
  aplicarLayoutFaturaA4Compartilhado,
  type ModeloFaturaId,
} from "@/lib/configuracoes-faturas";
import {
  gerarHtmlFaturaImpressao,
  montarDadosFaturaPreviewAmostra,
} from "@/lib/fatura-impressao-html";
import type { FaturaModeloLayout } from "@/lib/fatura-modelo-layout";
import { FATURA_A4_ALTURA_MM, FATURA_A4_LARGURA_MM } from "@/lib/fatura-modelo-layout";
import { PreviewFaturaModelo4Termica } from "@/components/configuracoes/ConfiguracoesFaturaModelo4Preview";

type Props = {
  cfg: ConfigLaboratorio;
  layout: FaturaModeloLayout;
  modeloId?: ModeloFaturaId;
  termica?: boolean;
};

const LARGURA_PREVIEW_MM = FATURA_A4_LARGURA_MM;

export function ConfiguracoesFaturaModeloPreview({
  cfg,
  layout,
  modeloId = "modelo1",
  termica,
}: Props) {
  const html = useMemo(() => {
    if (termica) return "";
    try {
      const configPreview = aplicarLayoutFaturaA4Compartilhado(CONFIG_FATURAS_PADRAO, layout);
      return gerarHtmlFaturaImpressao(
        montarDadosFaturaPreviewAmostra(),
        cfg,
        configPreview,
        { formato: "a4", modelo: modeloId, ocultarBotaoImprimir: true }
      );
    } catch {
      return "<!doctype html><html><body><p>Erro ao gerar pré-visualização.</p></body></html>";
    }
  }, [cfg, layout, modeloId, termica]);

  if (termica) {
    return (
      <div className="mx-auto flex justify-center">
        <PreviewFaturaModelo4Termica cfg={cfg} layout={layout} modeloId={modeloId} />
      </div>
    );
  }

  return (
    <div className="flex w-full justify-center overflow-x-auto py-2">
      <div
        className="origin-top"
        style={{
          width: `${LARGURA_PREVIEW_MM}mm`,
          maxWidth: "100%",
        }}
      >
        <iframe
          srcDoc={html}
          title="Pré-visualização da fatura"
          className="w-full border-0 bg-white"
          style={{
            width: "100%",
            aspectRatio: `${FATURA_A4_LARGURA_MM} / ${FATURA_A4_ALTURA_MM}`,
            height: "auto",
            minHeight: "720px",
            display: "block",
          }}
        />
      </div>
    </div>
  );
}
