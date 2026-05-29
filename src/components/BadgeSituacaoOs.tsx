import { metaStatusOs } from "@/lib/status-os";
import { cn } from "@/lib/utils";

/** Badge de situação igual ao Controle de Produção. */
export function BadgeSituacaoOs({
  status,
  className,
}: {
  status?: string | null;
  className?: string;
}) {
  const meta = metaStatusOs(status);
  return (
    <span
      className={cn(
        "inline-block rounded px-2 py-1 text-[10px] font-semibold whitespace-nowrap",
        meta.color,
        className
      )}
    >
      {meta.label}
    </span>
  );
}
