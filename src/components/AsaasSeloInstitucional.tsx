"use client";

import { useState } from "react";
import {
  ASAAS_SELO_OFICIAL_LOCAL_URL,
  ASAAS_SITE_URL,
  ASAAS_TERMOS_URL,
  textoInstitucionalAsaasCurto,
  textoServicosFinanceirosAsaas,
  urlSeloAsaas,
  type VarianteSeloAsaas,
} from "@/lib/asaas-marca-baas";
import { AsaasSeloSvg } from "@/components/AsaasSeloSvg";
import { cn } from "@/lib/utils";

type Props = {
  variante?: VarianteSeloAsaas;
  /** Texto completo sobre serviços financeiros (telas de conta digital). */
  detalhado?: boolean;
  className?: string;
};

type FonteSelo = "oficial" | "local" | "inline";

function SeloVisual({ variante }: { variante: VarianteSeloAsaas }) {
  const [fonte, setFonte] = useState<FonteSelo>("oficial");
  const escuro = variante === "escuro";

  if (fonte === "inline") {
    return <AsaasSeloSvg variante={variante} />;
  }

  const src = fonte === "oficial" ? urlSeloAsaas(variante) : ASAAS_SELO_OFICIAL_LOCAL_URL;

  return (
    <span className={cn("inline-flex shrink-0", escuro && "rounded-md bg-white px-2.5 py-1.5")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Serviços financeiros Asaas"
        width={188}
        height={69}
        className="h-10 w-auto max-w-[min(100%,220px)]"
        onError={() => setFonte((atual) => (atual === "oficial" ? "local" : "inline"))}
      />
    </span>
  );
}

export function AsaasSeloInstitucional({
  variante = "claro",
  detalhado = false,
  className,
}: Props) {
  const escuro = variante === "escuro";
  const textoCor = escuro ? "text-slate-400" : "text-slate-600";
  const linkCor = escuro ? "text-slate-300 hover:text-white" : "text-[#0038E5] hover:underline";

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 text-center text-[11px] leading-relaxed",
        textoCor,
        className
      )}
    >
      <a
        href={ASAAS_SITE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex shrink-0"
        aria-label="Asaas — Instituição de Pagamento"
      >
        <SeloVisual variante={variante} />
      </a>
      <p>
        {detalhado ? textoServicosFinanceirosAsaas() : textoInstitucionalAsaasCurto()}
      </p>
      <p className={cn("text-[10px]", escuro ? "text-slate-500" : "text-slate-500")}>
        <a href={ASAAS_SITE_URL} target="_blank" rel="noopener noreferrer" className={linkCor}>
          www.asaas.com
        </a>
        {" · "}
        <a href={ASAAS_TERMOS_URL} target="_blank" rel="noopener noreferrer" className={linkCor}>
          Termos Asaas
        </a>
      </p>
    </div>
  );
}
