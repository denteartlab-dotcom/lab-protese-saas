"use client";

import { useEffect, useMemo, useState } from "react";
import {
  carregarEtapasCadastro,
  etapasUnicasComCor,
  type EtapaOsLinha,
} from "@/lib/etapas-os";

type Props = {
  etapas: EtapaOsLinha[];
  className?: string;
};

export function EtapasControleCelula({ etapas, className }: Props) {
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    const atualizar = () => setVersao((v) => v + 1);
    window.addEventListener("focus", atualizar);
    window.addEventListener("storage", atualizar);
    return () => {
      window.removeEventListener("focus", atualizar);
      window.removeEventListener("storage", atualizar);
    };
  }, []);

  const badges = useMemo(() => {
    void versao;
    return etapasUnicasComCor(etapas, carregarEtapasCadastro());
  }, [etapas, versao]);

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
