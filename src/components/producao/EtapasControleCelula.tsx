"use client";

import { useEffect, useMemo, useState } from "react";
import {
  carregarEtapasCadastro,
  etapasUnicasComCor,
  type EtapaOsLinha,
} from "@/lib/etapas-os";
import {
  ARMAZENAMENTO_LAB_PRONTO_EVENT,
  revalidarArmazenamentoLaboratorio,
} from "@/lib/armazenamento-laboratorio";
import { etapaAtualLinhaOs } from "@/lib/modulo-producao-etapas";
import { TRABALHOS_ATUALIZADOS_EVENT } from "@/lib/trabalhos-events";

type Props = {
  etapas: EtapaOsLinha[];
  trabalhoId: string;
  itemId: string;
  className?: string;
};

export function EtapasControleCelula({ etapas, trabalhoId, itemId, className }: Props) {
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    const atualizar = () => setVersao((v) => v + 1);
    const revalidarEAtualizar = () => {
      void revalidarArmazenamentoLaboratorio(true).finally(atualizar);
    };

    window.addEventListener("focus", revalidarEAtualizar);
    window.addEventListener("storage", atualizar);
    window.addEventListener(TRABALHOS_ATUALIZADOS_EVENT, atualizar);
    window.addEventListener(ARMAZENAMENTO_LAB_PRONTO_EVENT, atualizar);
    // Progresso gravado no Módulo TV precisa chegar ao Controle.
    void revalidarArmazenamentoLaboratorio(true).finally(atualizar);

    return () => {
      window.removeEventListener("focus", revalidarEAtualizar);
      window.removeEventListener("storage", atualizar);
      window.removeEventListener(TRABALHOS_ATUALIZADOS_EVENT, atualizar);
      window.removeEventListener(ARMAZENAMENTO_LAB_PRONTO_EVENT, atualizar);
    };
  }, []);

  const badges = useMemo(() => {
    void versao;
    const etapaAtual = etapaAtualLinhaOs(etapas, trabalhoId, itemId);
    if (!etapaAtual) return [];
    return etapasUnicasComCor([etapaAtual], carregarEtapasCadastro());
  }, [etapas, trabalhoId, itemId, versao]);

  if (!badges.length) return null;

  return (
    <span className={`flex max-w-full flex-wrap gap-1 ${className || ""}`}>
      {badges.map((badge) => (
        <span
          key={badge.nome}
          className="inline-flex max-w-full truncate rounded px-2 py-0.5 text-[10px] font-medium leading-tight"
          style={{ backgroundColor: badge.cor, color: badge.texto }}
          title={badge.nome}
        >
          {badge.nome}
        </span>
      ))}
    </span>
  );
}
