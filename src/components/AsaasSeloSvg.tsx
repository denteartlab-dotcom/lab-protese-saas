import type { VarianteSeloAsaas } from "@/lib/asaas-marca-baas";
import { cn } from "@/lib/utils";

type Props = {
  variante?: VarianteSeloAsaas;
  className?: string;
};

/** Selo embutido — não depende de arquivo em /public (evita bloqueio de adblock em /asaas/). */
export function AsaasSeloSvg({ variante = "claro", className }: Props) {
  const escuro = variante === "escuro";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 36"
      width={120}
      height={36}
      role="img"
      aria-label="Asaas — Instituição de Pagamento"
      className={cn("h-8 w-auto shrink-0", className)}
    >
      <rect
        width={120}
        height={36}
        rx={6}
        fill={escuro ? "rgba(255,255,255,0.12)" : "#0038E5"}
        stroke={escuro ? "rgba(255,255,255,0.35)" : "none"}
      />
      <text
        x={60}
        y={16}
        textAnchor="middle"
        fill="#ffffff"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize={13}
        fontWeight={700}
      >
        ASAAS
      </text>
      <text
        x={60}
        y={28}
        textAnchor="middle"
        fill={escuro ? "#CBD5E1" : "#B8CCFF"}
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize={7}
        fontWeight={600}
      >
        INSTITUIÇÃO DE PAGAMENTO
      </text>
    </svg>
  );
}
