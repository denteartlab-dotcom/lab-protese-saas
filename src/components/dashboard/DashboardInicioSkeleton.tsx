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
    <div className="relative min-h-[118px] rounded border border-slate-200 bg-white px-4 pb-3 pt-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <Bloco className="h-4 w-16" />
        <Bloco className="h-6 w-28 rounded" />
      </div>
      <div className="mt-4 flex items-start justify-around gap-4 px-2">
        <div className="flex items-center gap-2">
          <Bloco className="h-9 w-9 rounded-full" />
          <div className="space-y-1">
            <Bloco className="h-3 w-8" />
            <Bloco className="h-3 w-20" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Bloco className="h-9 w-9 rounded-full" />
          <div className="space-y-1">
            <Bloco className="h-3 w-8" />
            <Bloco className="h-3 w-20" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardWidgetSkeleton({ alto = "min-h-[180px]" }: { alto?: string }) {
  return (
    <div
      className={`rounded border border-slate-200 bg-white px-4 pb-3 pt-3 shadow-sm ${alto}`}
      aria-busy="true"
    >
      <Bloco className="mb-4 h-4 w-32" />
      <div className="space-y-2">
        <Bloco className="h-3 w-full" />
        <Bloco className="h-3 w-4/5" />
        <Bloco className="h-3 w-2/3" />
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

      <Bloco className="h-16 w-full rounded border border-slate-200 bg-white" />

      <div className="grid gap-4 lg:grid-cols-3">
        <PainelSkeleton />
        <PainelSkeleton />
        <PainelEstoqueSkeleton />
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
