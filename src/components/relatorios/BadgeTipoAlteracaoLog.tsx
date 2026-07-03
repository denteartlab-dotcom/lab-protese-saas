import { labelTipoAlteracaoLog } from "@/lib/logs-auditoria-core";
import { cn } from "@/lib/utils";

const base =
  "inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-bold leading-none";

const estilos = {
  inclusao: `${base} bg-[#e8f8ef] text-[#27ae60]`,
  alteracao: `${base} bg-[#fef5e7] text-[#e67e22]`,
  exclusao: `${base} bg-[#fdecea] text-[#e74c3c]`,
} as const;

function varianteTipo(tipo: string): keyof typeof estilos {
  if (tipo === "inclusao") return "inclusao";
  if (tipo === "exclusao") return "exclusao";
  return "alteracao";
}

export function BadgeTipoAlteracaoLog({
  tipo,
  className,
}: {
  tipo: string;
  className?: string;
}) {
  const variante = varianteTipo(tipo);
  return (
    <span className={cn(estilos[variante], className)}>
      {labelTipoAlteracaoLog(tipo)}
    </span>
  );
}
