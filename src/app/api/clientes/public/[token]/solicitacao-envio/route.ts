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

function mensagemErroPrisma(err: unknown): string {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: string }).code)
      : "";
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (code === "P2021" || code === "P2022") {
    return "A tabela de pedidos de envio ainda não existe no banco. Rode prisma db push no servidor.";
  }
  if (msg.includes("permission denied") || msg.includes("42501")) {
    return "O banco ainda não liberou a tabela de pedidos de envio para o app. No servidor rode: npm run db:grant-app && npm run db:rls";
  }
  if (msg) return msg;
  return "Não foi possível salvar a solicitação.";
}

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
    const campos = Object.keys(parsed.error.flatten().fieldErrors);
    return NextResponse.json(
      {
        error: "validacao",
        message: campos.length
          ? `Revise os campos: ${campos.join(", ")}.`
          : "Preencha os dados obrigatórios do pedido.",
        detalhes: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  try {
    const nomeCliente =
      resultado.cliente.nome?.trim() ||
      resultado.cliente.razaoSocial?.trim() ||
      "";
    const dadosComCliente = {
      ...parsed.data,
      // Cliente vem do token do link; dentista herda o nome se vier vazio.
      dentista: parsed.data.dentista?.trim() || nomeCliente,
    };
    const criada = await runWithTenantContext(resultado.cliente.empresaId, () =>
      criarSolicitacaoEnvioCliente({
        empresaId: resultado.cliente.empresaId,
        clienteId: resultado.cliente.id,
        dados: dadosComCliente,
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
  } catch (err) {
    console.error("[solicitacao-envio] POST", err);
    return NextResponse.json(
      { error: "salvar_falhou", message: mensagemErroPrisma(err) },
      { status: 500 }
    );
  }
}
