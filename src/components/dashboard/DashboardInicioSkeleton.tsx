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

function PainelEstoqueSkeleton() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 bg-transparent px-0 py-1">
      <Bloco className="h-4 w-16" />
      <div className="flex flex-1 justify-center gap-10 sm:justify-end">
        <div className="flex flex-col items-center gap-1.5">
          <Bloco className="h-11 w-11 rounded-full" />
          <Bloco className="h-3 w-20" />
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <Bloco className="h-11 w-11 rounded-full" />
          <Bloco className="h-3 w-20" />
        </div>
      </div>
      <Bloco className="h-6 w-28 rounded" />
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

      <PainelEstoqueSkeleton />

      <div className="grid gap-4 lg:grid-cols-2">
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
