"use client";

import { TvDashboard } from "@/components/modulo-tv/TvDashboard";
import { TvQueryProvider } from "@/components/modulo-tv/providers/TvQueryProvider";

export function ModuloTvConteudo() {
  return (
    <TvQueryProvider>
      <TvDashboard />
    </TvQueryProvider>
  );
}
