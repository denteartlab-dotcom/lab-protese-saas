import { TV_OS_CARD } from "@/components/modulo-tv/tv-styles";
import { cn } from "@/lib/utils";

export function TvSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "tv-shimmer rounded-md bg-gradient-to-r from-slate-800/50 via-slate-700/30 to-slate-800/50",
        className
      )}
    />
  );
}

export function TvCardSkeleton() {
  return (
    <div className={cn("space-y-2 p-3", TV_OS_CARD)}>
      <TvSkeleton className="h-4 w-14" />
      <TvSkeleton className="h-3 w-full" />
      <TvSkeleton className="h-3 w-3/4" />
      <TvSkeleton className="h-3 w-1/2" />
    </div>
  );
}
