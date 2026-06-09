"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AUTO_REFRESH_MS } from "@/components/modulo-tv/constants";

export function TvQueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5_000,
            refetchOnWindowFocus: true,
            retry: 2,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={client}>
      <div data-tv-refresh-ms={AUTO_REFRESH_MS}>{children}</div>
    </QueryClientProvider>
  );
}
