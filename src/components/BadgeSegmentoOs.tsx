import { badgeSegmentoOs } from "@/lib/trabalho-os-segmento";

export function BadgeSegmentoOs({
  trabalho,
}: {
  trabalho: {
    segmentoFaturamento?: string | null;
    instrucoes?: string | null;
  };
}) {
  const tipo = badgeSegmentoOs(trabalho);
  if (tipo === "produto") {
    return (
      <span className="ml-1.5 inline-flex items-center rounded-full bg-slate-600 px-2 py-0.5 text-[10px] font-semibold text-white">
        Produto
      </span>
    );
  }
  if (tipo === "transporte") {
    return (
      <span className="ml-1.5 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
        Transporte
      </span>
    );
  }
  return null;
}
