"use client";

import { useEffect } from "react";

/** Remove o zoom global do site e fundo claro — visualizador nativo do navegador em tela cheia. */
export function PdfViewerAmbiente({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const zoomAnterior = html.style.zoom;
    const bgAnterior = body.style.backgroundColor;

    html.style.zoom = "1";
    body.style.backgroundColor = "#525659";

    return () => {
      html.style.zoom = zoomAnterior;
      body.style.backgroundColor = bgAnterior;
    };
  }, []);

  return <>{children}</>;
}
