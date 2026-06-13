import { NextResponse } from "next/server";
import { buscarClientePublicoPorToken } from "@/lib/tenant-db";
import { MENSAGEM_LINK_ACOMPANHAMENTO_INVALIDO } from "@/lib/cliente-acompanhamento";
import { removerUrgenciaCliente } from "@/lib/urgencia-cliente";

type Params = { params: Promise<{ token: string }> };

export async function POST(request: Request, { params }: Params) {
  const { token } = await params;

  const resultado = await buscarClientePublicoPorToken(token);
  if (!resultado) {
    return NextResponse.json(
      { error: "link_invalido", message: MENSAGEM_LINK_ACOMPANHAMENTO_INVALIDO },
      { status: 404 }
    );
  }

  let body: { trabalhoId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "payload_invalido", message: "Dados inválidos." },
      { status: 400 }
    );
  }

  const trabalhoId = String(body.trabalhoId || "").trim();
  if (!trabalhoId) {
    return NextResponse.json(
      { error: "trabalho_obrigatorio", message: "Informe o trabalho." },
      { status: 400 }
    );
  }

  const { cliente, trabalhos } = resultado;
  const res = await removerUrgenciaCliente({
    cliente: { id: cliente.id },
    trabalhoId,
    trabalhosVisiveis: trabalhos.map((t) => ({
      id: t.id,
      numeroOs: t.numeroOs,
      status: t.status,
      tipoProtese: t.tipoProtese,
      instrucoes: t.instrucoes,
    })),
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: res.code, message: res.message },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Urgência removida deste trabalho.",
  });
}
