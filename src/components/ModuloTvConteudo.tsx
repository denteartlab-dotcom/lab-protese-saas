"use client";

import { TvDashboard } from "@/components/modulo-tv/TvDashboard";
import { TvErrorBoundary } from "@/components/modulo-tv/TvErrorBoundary";
import { TvQueryProvider } from "@/components/modulo-tv/providers/TvQueryProvider";

export function ModuloTvConteudo() {
  return (
    <TvErrorBoundary>
      <TvQueryProvider>
        <TvDashboard />
      </TvQueryProvider>
    </TvErrorBoundary>
  );
}
