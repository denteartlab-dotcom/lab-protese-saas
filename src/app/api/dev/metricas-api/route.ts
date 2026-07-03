import { NextResponse } from "next/server";
import { metricasApiHabilitadas, resumoMetricasApi } from "@/lib/api-observabilidade";

/** Somente desenvolvimento — issue 001. */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Indisponível em produção" }, { status: 404 });
  }

  return NextResponse.json({
    habilitado: metricasApiHabilitadas(),
    dica: "Use npm run dev:server para medir todas as rotas via server.ts. Consulte com npm run metrics:api.",
    ...resumoMetricasApi(25),
  });
}
