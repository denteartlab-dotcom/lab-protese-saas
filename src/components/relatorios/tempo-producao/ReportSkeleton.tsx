"use client";

export function ReportSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-[#e8ecf2] bg-white p-5 shadow-sm"
          >
            <div className="h-11 w-11 rounded-2xl bg-slate-100" />
            <div className="mt-4 h-3 w-24 rounded bg-slate-100" />
            <div className="mt-3 h-8 w-20 rounded bg-slate-200" />
            <div className="mt-2 h-3 w-32 rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-[#e8ecf2] bg-white p-6 shadow-sm">
        <div className="mb-6 h-6 w-64 rounded bg-slate-200" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="mb-3 h-12 rounded-xl bg-slate-50" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-80 rounded-2xl border border-[#e8ecf2] bg-white shadow-sm" />
        ))}
      </div>
    </div>
  );
}
