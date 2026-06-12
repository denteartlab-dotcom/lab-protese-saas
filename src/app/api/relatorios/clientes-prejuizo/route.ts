import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  obterRelatorioClientesPrejuizoMock,
  type PeriodoClientesPrejuizo,
} from "@/lib/relatorio-clientes-prejuizo";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const periodo = (searchParams.get("periodo") || "30dias") as PeriodoClientesPrejuizo;
  const dataInicio = searchParams.get("dataInicio") || "";
  const dataFim = searchParams.get("dataFim") || "";

  const payload = obterRelatorioClientesPrejuizoMock({
    periodo,
    dataInicio: dataInicio || undefined,
    dataFim: dataFim || undefined,
  });

  return NextResponse.json(payload);
}
