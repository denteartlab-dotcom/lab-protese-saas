import { NextResponse } from "next/server";
import {
  mapearBrasilApiCnpj,
  mapearReceitaWsCnpj,
  mesclarDadosCnpj,
} from "@/lib/cnpj-lookup";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cnpj: string }> }
) {
  const { cnpj: cnpjParam } = await params;
  const cnpj = cnpjParam.replace(/\D/g, "");

  if (cnpj.length !== 14) {
    return NextResponse.json({ error: "CNPJ deve ter 14 dígitos." }, { status: 400 });
  }

  try {
    const [brasilRes, receitaRes] = await Promise.allSettled([
      fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
        headers: { Accept: "application/json" },
        next: { revalidate: 3600 },
      }),
      fetch(`https://www.receitaws.com.br/v1/cnpj/${cnpj}`, {
        headers: { Accept: "application/json" },
        next: { revalidate: 3600 },
      }),
    ]);

    let dados = mesclarDadosCnpj();

    if (brasilRes.status === "fulfilled" && brasilRes.value.ok) {
      const body = (await brasilRes.value.json()) as Record<string, unknown>;
      dados = mesclarDadosCnpj(dados, mapearBrasilApiCnpj(body));
    }

    if (receitaRes.status === "fulfilled" && receitaRes.value.ok) {
      const body = (await receitaRes.value.json()) as Record<string, unknown>;
      if (body.status !== "ERROR") {
        dados = mesclarDadosCnpj(dados, mapearReceitaWsCnpj(body));
      }
    }

    if (!dados.razaoSocial && !dados.nomeFantasia) {
      return NextResponse.json(
        { error: "CNPJ não encontrado ou indisponível na consulta." },
        { status: 404 }
      );
    }

    return NextResponse.json(dados);
  } catch {
    return NextResponse.json(
      { error: "Não foi possível consultar o CNPJ no momento." },
      { status: 502 }
    );
  }
}
