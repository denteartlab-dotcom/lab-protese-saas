"use client";

import { useState } from "react";
import {
  ASAAS_SITE_URL,
  ASAAS_TERMOS_URL,
  textoInstitucionalAsaasCurto,
  textoServicosFinanceirosAsaas,
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

function seloUrlCustomizada(variante: VarianteSeloAsaas): string | null {
  const env =
    variante === "escuro"
      ? process.env.NEXT_PUBLIC_ASAAS_SELO_ESCURO_URL?.trim()
      : process.env.NEXT_PUBLIC_ASAAS_SELO_CLARO_URL?.trim();
  if (!env) return null;
  if (env.startsWith("/asaas/")) return null;
  return env;
}

function SeloVisual({ variante }: { variante: VarianteSeloAsaas }) {
  const [imgFalhou, setImgFalhou] = useState(false);
  const urlCustom = seloUrlCustomizada(variante);

  if (urlCustom && !imgFalhou) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={urlCustom}
        alt="Asaas — Instituição de Pagamento"
        width={120}
        height={36}
        className="h-8 w-auto shrink-0"
        onError={() => setImgFalhou(true)}
      />
    );
  }

  return <AsaasSeloSvg variante={variante} />;
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
