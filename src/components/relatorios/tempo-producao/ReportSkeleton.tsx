"use client";

export function ReportSkeleton() {
  return (
    <div className="animate-pulse space-y-5" aria-hidden>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-slate-700 dark:bg-slate-800"
          >
            <div className="h-10 bg-slate-200 dark:bg-slate-700" />
            <div className="space-y-2 px-3 py-3">
              <div className="h-6 w-2/3 rounded bg-slate-100 dark:bg-slate-700" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="h-72 rounded-xl border border-slate-200/80 bg-white dark:border-slate-700 dark:bg-slate-800 xl:col-span-2" />
        <div className="h-72 rounded-xl border border-slate-200/80 bg-white dark:border-slate-700 dark:bg-slate-800" />
      </div>

      <div className="h-64 rounded-xl border border-slate-200/80 bg-white dark:border-slate-700 dark:bg-slate-800" />

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-700">
          <div className="h-4 w-40 rounded bg-slate-100 dark:bg-slate-700" />
        </div>
        <div className="space-y-2 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 rounded bg-slate-50 dark:bg-slate-700/60" />
          ))}
        </div>
      </div>
    </div>
  );
}
