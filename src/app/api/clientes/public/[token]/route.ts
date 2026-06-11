import { NextResponse } from "next/server";
import { buscarClientePublicoPorToken } from "@/lib/tenant-db";
import {
  MENSAGEM_LINK_ACOMPANHAMENTO_INVALIDO,
  montarAcompanhamentoPublico,
} from "@/lib/cliente-acompanhamento";
import { carregarStoreUrgenciasCliente } from "@/lib/urgencia-cliente";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { token } = await params;

  const resultado = await buscarClientePublicoPorToken(token);

  if (!resultado) {
    return NextResponse.json(
      { error: "link_invalido", message: MENSAGEM_LINK_ACOMPANHAMENTO_INVALIDO },
      { status: 404 }
    );
  }

  const { cliente, trabalhos, labNome, mapaEtapas } = resultado;
  const storeUrgencias = await carregarStoreUrgenciasCliente();

  const payload = montarAcompanhamentoPublico(
    {
      id: cliente.id,
      nome: cliente.nome,
      razaoSocial: cliente.razaoSocial,
      observacoes: cliente.observacoes,
    },
    trabalhos,
    labNome,
    mapaEtapas,
    storeUrgencias.eventos
  );

  return NextResponse.json(payload);
}
