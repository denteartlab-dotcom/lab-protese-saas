function Bloco({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200/80 ${className}`} />;
}

function PainelSkeleton({ alto = "min-h-[118px]" }: { alto?: string }) {
  return (
    <div
      className={`rounded border border-slate-200 bg-white px-4 pb-3 pt-3 shadow-sm ${alto}`}
    >
      <Bloco className="mb-4 h-4 w-32" />
      <div className="flex justify-center gap-6">
        <Bloco className="h-9 w-9 rounded-full" />
        <Bloco className="h-9 w-9 rounded-full" />
      </div>
    </div>
  );
}

export function DashboardInicioSkeleton() {
  return (
    <div className="space-y-4 text-[13px]" aria-busy="true" aria-label="Carregando início">
      <div className="flex items-center gap-2">
        <Bloco className="h-4 w-12" />
        <Bloco className="h-4 w-4" />
        <Bloco className="h-4 w-16" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <PainelSkeleton />
        <PainelSkeleton />
        <PainelSkeleton />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <PainelSkeleton alto="min-h-[220px]" />
        <PainelSkeleton alto="min-h-[220px]" />
        <PainelSkeleton alto="min-h-[220px]" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <PainelSkeleton alto="min-h-[180px]" />
        <PainelSkeleton alto="min-h-[180px]" />
        <PainelSkeleton alto="min-h-[180px]" />
      </div>
    </div>
  );
}
