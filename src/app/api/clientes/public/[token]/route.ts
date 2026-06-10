import { NextResponse } from "next/server";
import { buscarClientePublicoPorToken } from "@/lib/tenant-db";
import { montarAcompanhamentoPublico } from "@/lib/cliente-acompanhamento";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { token } = await params;

  const resultado = await buscarClientePublicoPorToken(token);

  if (!resultado) {
    return NextResponse.json(
      { error: "link_invalido", message: "Link de acompanhamento inválido ou expirado." },
      { status: 404 }
    );
  }

  const { cliente, trabalhos, labNome, mapaEtapas } = resultado;

  const payload = montarAcompanhamentoPublico(
    { nome: cliente.nome, razaoSocial: cliente.razaoSocial },
    trabalhos,
    labNome,
    mapaEtapas
  );

  return NextResponse.json(payload);
}
