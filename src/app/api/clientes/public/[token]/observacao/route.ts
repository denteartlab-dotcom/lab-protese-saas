import { NextResponse } from "next/server";
import { runWithTenantContext } from "@/lib/db";
import { MENSAGEM_LINK_ACOMPANHAMENTO_INVALIDO } from "@/lib/cliente-acompanhamento";
import {
  LIMITE_TEXTO_OBSERVACAO_CLIENTE,
  excluirObservacaoClienteTrabalho,
  registrarObservacaoClienteTrabalho,
} from "@/lib/observacao-cliente-trabalho";
import { buscarClientePublicoPorToken } from "@/lib/tenant-db";

type Params = { params: Promise<{ token: string }> };

export async function DELETE(request: Request, { params }: Params) {
  const { token } = await params;
  const resultado = await buscarClientePublicoPorToken(token);
  if (!resultado) {
    return NextResponse.json(
      { error: "link_invalido", message: MENSAGEM_LINK_ACOMPANHAMENTO_INVALIDO },
      { status: 404 }
    );
  }

  let body: { observacaoId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "payload_invalido", message: "Dados inválidos." },
      { status: 400 }
    );
  }

  const observacaoId = String(body.observacaoId || "").trim();
  if (!observacaoId) {
    return NextResponse.json(
      { error: "observacao_obrigatoria", message: "Informe a observação." },
      { status: 400 }
    );
  }

  const res = await runWithTenantContext(resultado.cliente.empresaId, () =>
    excluirObservacaoClienteTrabalho({
      empresaId: resultado.cliente.empresaId,
      clienteId: resultado.cliente.id,
      observacaoId,
    })
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: res.code, message: res.message },
      { status: res.code === "nao_encontrada" ? 404 : 403 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Observação excluída.",
    observacaoId: res.observacaoId,
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

  let body: { trabalhoId?: string; texto?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "payload_invalido", message: "Dados inválidos." },
      { status: 400 }
    );
  }

  const trabalhoId = String(body.trabalhoId || "").trim();
  const texto = String(body.texto || "");
  if (!trabalhoId) {
    return NextResponse.json(
      { error: "trabalho_obrigatorio", message: "Informe o trabalho." },
      { status: 400 }
    );
  }
  if (texto.length > LIMITE_TEXTO_OBSERVACAO_CLIENTE) {
    return NextResponse.json(
      {
        error: "texto_longo",
        message: `A observação pode ter no máximo ${LIMITE_TEXTO_OBSERVACAO_CLIENTE} caracteres.`,
      },
      { status: 400 }
    );
  }

  // Não confia no trabalhoId enviado: ele precisa estar visível para este token/cliente.
  const trabalho = resultado.trabalhos.find((item) => item.id === trabalhoId);
  if (!trabalho) {
    return NextResponse.json(
      { error: "nao_autorizado", message: "Trabalho não encontrado neste acompanhamento." },
      { status: 403 }
    );
  }

  const res = await runWithTenantContext(resultado.cliente.empresaId, () =>
    registrarObservacaoClienteTrabalho({
      empresaId: resultado.cliente.empresaId,
      cliente: {
        id: resultado.cliente.id,
        nome: resultado.cliente.nome,
      },
      trabalho: {
        id: trabalho.id,
        numeroOs: trabalho.numeroOs,
        pacienteNome: trabalho.paciente.nome,
        tipoProtese: trabalho.tipoProtese,
      },
      texto,
    })
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: res.code, message: res.message },
      { status: res.code === "muitas_observacoes" ? 429 : 400 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      message: "Observação enviada ao laboratório.",
      observacaoId: res.evento.id,
    },
    { status: 201 }
  );
}
