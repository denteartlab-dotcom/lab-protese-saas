"use client";

import { useEffect, useMemo, useRef } from "react";
import { useI18n } from "@/components/i18n-provider";
import type { ConfigLaboratorio } from "@/lib/configuracoes-lab";
import {
  CONFIG_FATURAS_PADRAO,
  type ModeloFaturaId,
} from "@/lib/configuracoes-faturas";
import {
  gerarHtmlFaturaImpressao,
  montarDadosFaturaPreviewAmostra,
} from "@/lib/fatura-impressao-html";
import type { FaturaModeloLayout } from "@/lib/fatura-modelo-layout";
import { FATURA_A4_ALTURA_MM, FATURA_A4_LARGURA_MM } from "@/lib/fatura-modelo-layout";
import { PreviewFaturaModelo4Termica } from "@/components/configuracoes/ConfiguracoesFaturaModelo4Preview";
import { ligarSelecaoTexto } from "@/lib/fonte-impressao";

type Props = {
  cfg: ConfigLaboratorio;
  layout: FaturaModeloLayout;
  modeloId?: ModeloFaturaId;
  termica?: boolean;
  onTextoMarcado?: () => void;
};

const LARGURA_PREVIEW_MM = FATURA_A4_LARGURA_MM;

export function ConfiguracoesFaturaModeloPreview({
  cfg,
  layout,
  modeloId = "modelo1",
  termica,
  onTextoMarcado,
}: Props) {
  const { locale } = useI18n();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const limparSelecaoRef = useRef<(() => void) | null>(null);
  const aoMarcarRef = useRef(onTextoMarcado);
  aoMarcarRef.current = onTextoMarcado;

  function aoCarregarPreview() {
    limparSelecaoRef.current?.();
    const documento = iframeRef.current?.contentDocument;
    if (!documento) return;
    limparSelecaoRef.current = ligarSelecaoTexto(documento, () => {
      aoMarcarRef.current?.();
    });
  }

  useEffect(() => () => limparSelecaoRef.current?.(), []);
  const html = useMemo(() => {
    if (termica) return "";
    try {
      return gerarHtmlFaturaImpressao(
        montarDadosFaturaPreviewAmostra(),
        cfg,
        CONFIG_FATURAS_PADRAO,
        {
          formato: "a4",
          modelo: modeloId,
          ocultarBotaoImprimir: true,
          layoutOverride: layout,
          locale,
        }
      );
    } catch {
      return "<!doctype html><html><body><p>Erro ao gerar pré-visualização.</p></body></html>";
    }
  }, [cfg, layout, modeloId, termica, locale]);

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
          ref={iframeRef}
          srcDoc={html}
          onLoad={aoCarregarPreview}
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
