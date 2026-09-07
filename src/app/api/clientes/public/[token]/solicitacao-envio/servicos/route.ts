import { NextResponse } from "next/server";
import { runWithTenantContext } from "@/lib/db";
import { MENSAGEM_LINK_ACOMPANHAMENTO_INVALIDO } from "@/lib/cliente-acompanhamento";
import { exigirSessaoPortalAcompanhamento } from "@/lib/cliente-portal-auth";
import { buscarClientePublicoPorToken } from "@/lib/tenant-db";
import { listarNomesServicosTabelaCliente } from "@/lib/solicitacao-envio-servidor";

type Params = { params: Promise<{ token: string }> };

export async function GET(request: Request, { params }: Params) {
  const { token } = await params;
  const auth = await exigirSessaoPortalAcompanhamento(request, token);
  if (!auth.ok) return auth.response;
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
