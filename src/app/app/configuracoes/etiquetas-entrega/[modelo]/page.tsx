"use client";

import { useParams } from "next/navigation";
import { ConfiguracoesEtiquetaEntregaEditor } from "@/components/configuracoes/ConfiguracoesEtiquetaEntregaEditor";
import { modeloEtiquetaEntregaValido } from "@/lib/configuracoes-etiqueta-entrega";

export default function ConfiguracoesEtiquetaEntregaModeloPage() {
  const params = useParams<{ modelo: string }>();
  const id = String(params?.modelo || "");
  if (!modeloEtiquetaEntregaValido(id)) {
    return <p className="p-6 text-sm text-slate-500">Modelo não encontrado.</p>;
  }
  return <ConfiguracoesEtiquetaEntregaEditor modelo={id} />;
}
