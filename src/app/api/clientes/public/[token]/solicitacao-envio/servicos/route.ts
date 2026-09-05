import { NextResponse } from "next/server";
import { runWithTenantContext } from "@/lib/db";
import { MENSAGEM_LINK_ACOMPANHAMENTO_INVALIDO } from "@/lib/cliente-acompanhamento";
import { buscarClientePublicoPorToken } from "@/lib/tenant-db";
import { listarNomesServicosTabelaCliente } from "@/lib/solicitacao-envio-servidor";

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

  const { tabela, servicos } = await runWithTenantContext(
    resultado.cliente.empresaId,
    () =>
      listarNomesServicosTabelaCliente({
        empresaId: resultado.cliente.empresaId,
        observacoesCliente: resultado.cliente.observacoes,
      })
  );

  return NextResponse.json({
    tabela,
    servicos,
  });
}
