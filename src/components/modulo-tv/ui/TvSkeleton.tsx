import { cn } from "@/lib/utils";

export function TvSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-gradient-to-r from-slate-800/80 via-slate-700/50 to-slate-800/80",
        className
      )}
    />
  );
}

export function TvCardSkeleton() {
  return (
    <div className="space-y-2 rounded-xl border border-slate-700/40 bg-slate-900/40 p-3">
      <TvSkeleton className="h-4 w-16" />
      <TvSkeleton className="h-3 w-full" />
      <TvSkeleton className="h-3 w-4/5" />
      <div className="flex gap-2 pt-1">
        <TvSkeleton className="h-5 w-14 rounded-full" />
        <TvSkeleton className="h-5 w-20 rounded-full" />
      </div>
    </div>
  );
}
