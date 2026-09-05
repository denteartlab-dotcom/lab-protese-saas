import { NextResponse } from "next/server";
import { runWithTenantContext } from "@/lib/db";
import { MENSAGEM_LINK_ACOMPANHAMENTO_INVALIDO } from "@/lib/cliente-acompanhamento";
import { buscarClientePublicoPorToken } from "@/lib/tenant-db";
import {
  criarSolicitacaoEnvioCliente,
  listarSolicitacoesEnvioCliente,
  serializarSolicitacaoEnvio,
} from "@/lib/solicitacao-envio-servidor";
import { schemaCriarSolicitacaoEnvio } from "@/lib/solicitacao-envio-types";

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

  const lista = await runWithTenantContext(resultado.cliente.empresaId, () =>
    listarSolicitacoesEnvioCliente({
      empresaId: resultado.cliente.empresaId,
      clienteId: resultado.cliente.id,
      limite: 30,
    })
  );

  return NextResponse.json({
    solicitacoes: lista.map(serializarSolicitacaoEnvio),
  });
}

export async function POST(request: Request, { params }: Params) {
  const { token } = await params;
  const resultado = await buscarClientePublicoPorToken(token);
  if (!resultado) {
    return NextResponse.json(
      { error: "link_invalido", message: MENSAGEM_LINK_ACOMPANHAMENTO_INVALIDO },
      { status: 404 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "payload_invalido", message: "Dados inválidos." },
      { status: 400 }
    );
  }

  const parsed = schemaCriarSolicitacaoEnvio.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "validacao",
        message: "Preencha os dados obrigatórios do pedido.",
        detalhes: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const criada = await runWithTenantContext(resultado.cliente.empresaId, () =>
    criarSolicitacaoEnvioCliente({
      empresaId: resultado.cliente.empresaId,
      clienteId: resultado.cliente.id,
      dados: parsed.data,
    })
  );

  return NextResponse.json(
    {
      ok: true,
      message: "Solicitação enviada ao laboratório.",
      solicitacao: serializarSolicitacaoEnvio(criada),
    },
    { status: 201 }
  );
}
