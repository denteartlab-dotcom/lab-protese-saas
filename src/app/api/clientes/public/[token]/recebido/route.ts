import { NextResponse } from "next/server";
import { buscarClientePublicoPorToken } from "@/lib/tenant-db";
import { MENSAGEM_LINK_ACOMPANHAMENTO_INVALIDO } from "@/lib/cliente-acompanhamento";
import { confirmarRecebimentoCliente } from "@/lib/recebimento-cliente";

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

  let body: { trabalhoId?: string; nomeRecebedor?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "payload_invalido", message: "Dados inválidos." },
      { status: 400 }
    );
  }

  const trabalhoId = String(body.trabalhoId || "").trim();
  const nomeRecebedor = String(body.nomeRecebedor || "").trim();

  if (!trabalhoId) {
    return NextResponse.json(
      { error: "trabalho_obrigatorio", message: "Informe o trabalho." },
      { status: 400 }
    );
  }

  if (!nomeRecebedor) {
    return NextResponse.json(
      { error: "nome_obrigatorio", message: "Informe o nome de quem recebeu." },
      { status: 400 }
    );
  }

  const { cliente, trabalhos } = resultado;
  const res = await confirmarRecebimentoCliente({
    cliente: { id: cliente.id, nome: cliente.nome },
    trabalhoId,
    nomeRecebedor,
    trabalhosVisiveis: trabalhos.map((t) => ({
      id: t.id,
      numeroOs: t.numeroOs,
      status: t.status,
    })),
  });

  if (!res.ok) {
    const status =
      res.code === "ja_recebido"
        ? 409
        : res.code === "nao_autorizado"
          ? 403
          : 400;
    return NextResponse.json({ error: res.code, message: res.message }, { status });
  }

  return NextResponse.json({
    ok: true,
    message: res.message,
    recebimento: res.evento,
  });
}
