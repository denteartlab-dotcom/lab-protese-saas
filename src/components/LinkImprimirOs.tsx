"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  carregarConfiguracoesOs,
  formatoPorModeloOs,
  type ModeloOsId,
} from "@/lib/configuracoes-os";
import { segmentoEfetivoTrabalho } from "@/lib/trabalho-os-segmento";
import {
  montarUrlImpressaoOs,
  type FormatoImpressaoOs,
  type TrabalhoImpressaoOs,
} from "@/components/ImprimirOsModal";

type LinkImprimirOsProps = {
  trabalho: Pick<TrabalhoImpressaoOs, "id" | "segmentoFaturamento" | "instrucoes" | "tipoProtese">;
  multiplosSegmentos?: boolean;
  somenteItem?: boolean;
  className?: string;
  children: ReactNode;
};

/** Abre a impressão A4/térmica com o modelo padrão salvo em Configurações → OS. */
export function LinkImprimirOs({
  trabalho,
  multiplosSegmentos = false,
  somenteItem = false,
  className,
  children,
}: LinkImprimirOsProps) {
  const cfg = carregarConfiguracoesOs();
  const modelo: ModeloOsId = cfg.modeloPadrao;
  const formato = formatoPorModeloOs(modelo) as FormatoImpressaoOs;
  const href = montarUrlImpressaoOs(trabalho.id, {
    somenteItemSelecionado: somenteItem,
    multiplosSegmentos,
    segmentoEfetivo: segmentoEfetivoTrabalho(trabalho),
    formato,
    modelo,
    duasVias: cfg.duasVias[modelo],
  });

  return (
    <Link href={href} target="_blank" className={className}>
      {children}
    </Link>
  );
}
