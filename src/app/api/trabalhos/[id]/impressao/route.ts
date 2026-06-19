import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import {
  carregarDadosImpressaoOs,
  mensagemErroImpressaoOs,
} from "@/lib/impressao-os-dados";

function searchParamsRecord(url: string) {
  const params = new URL(url).searchParams;
  const sp: Record<string, string | string[] | undefined> = {};
  params.forEach((value, key) => {
    const atual = sp[key];
    if (atual === undefined) {
      sp[key] = value;
      return;
    }
    if (Array.isArray(atual)) {
      atual.push(value);
      return;
    }
    sp[key] = [atual, value];
  });
  return sp;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const sp = searchParamsRecord(request.url);

  try {
    const resultado = await carregarDadosImpressaoOs({
      id,
      empresaId: ctx.empresaId,
      sp,
    });

    if (!resultado.ok) {
      return NextResponse.json(
        { error: resultado.titulo, detalhe: resultado.detalhe },
        { status: resultado.status }
      );
    }

    return NextResponse.json({
      dados: resultado.dados,
      formato: resultado.opcoes.formato,
      modelo: resultado.opcoes.modelo,
      duasVias: resultado.opcoes.duasVias,
    });
  } catch (err) {
    console.error("api imprimir OS", { id, empresaId: ctx.empresaId, err });
    return NextResponse.json(
      {
        error: "Erro ao abrir a impressão.",
        detalhe: mensagemErroImpressaoOs(err),
      },
      { status: 500 }
    );
  }
}
