import { NextResponse } from "next/server";
import { buscarClientePublicoPorToken } from "@/lib/tenant-db";
import { solicitarUrgenciaCliente } from "@/lib/urgencia-cliente";

type Params = { params: Promise<{ token: string }> };

export async function POST(request: Request, { params }: Params) {
  const { token } = await params;

  const resultado = await buscarClientePublicoPorToken(token);
  if (!resultado) {
    return NextResponse.json(
      { error: "link_invalido", message: "Link de acompanhamento inválido ou expirado." },
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

  const { cliente } = resultado;
  const res = await solicitarUrgenciaCliente({
    cliente: { id: cliente.id, nome: cliente.nome },
    trabalhoId,
  });

  if (!res.ok) {
    const status =
      res.code === "limite_dia" || res.code === "limite_ativo" ? 429 : 400;
    return NextResponse.json(
      { error: res.code, message: res.message },
      { status }
    );
  }

  return NextResponse.json({
    ok: true,
    jaExistia: res.jaExistia,
    message: res.jaExistia
      ? "Este trabalho já está marcado como urgente."
      : "Trabalho sinalizado como urgente. O laboratório foi notificado.",
  });
}
