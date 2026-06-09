import { TV_GLASS_SUBTLE } from "@/components/modulo-tv/tv-styles";
import { cn } from "@/lib/utils";

export function TvSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "tv-shimmer rounded-lg bg-gradient-to-r from-slate-800/60 via-slate-600/40 to-slate-800/60",
        className
      )}
    />
  );
}

export function TvCardSkeleton() {
  return (
    <div className={cn("space-y-2.5 p-3 tv:p-3.5", TV_GLASS_SUBTLE)}>
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
