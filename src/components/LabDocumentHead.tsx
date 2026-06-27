"use client";

import { useEffect } from "react";
import { montarTituloDocumento } from "@/lib/document-title";

/** Título fixo da aba do navegador (ícone permanece o favicon padrão do app). */
export function LabDocumentHead() {
  useEffect(() => {
    document.title = montarTituloDocumento();
  }, []);

  return null;
}
