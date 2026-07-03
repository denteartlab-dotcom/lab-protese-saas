import { NextResponse } from "next/server";
import { medirHandlerApi } from "@/lib/api-observabilidade";
import {
  montarPortalPublico,
  MENSAGEM_PORTAL_PUBLICO_INDISPONIVEL,
  PortalPublicoErro,
} from "@/lib/portal-publico-server";
import { tipoPortalPublicoValido } from "@/lib/portal-publico-types";

export const GET = medirHandlerApi("/api/public/pagina", async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get("tipo")?.trim() || "";
  const token = searchParams.get("token")?.trim() || "";

  if (!tipoPortalPublicoValido(tipo)) {
    return NextResponse.json(
      { error: "tipo_invalido", message: "Tipo de portal inválido." },
      { status: 400 }
    );
  }

  if (!token) {
    return NextResponse.json(
      { error: "token_invalido", message: MENSAGEM_PORTAL_PUBLICO_INDISPONIVEL },
      { status: 404 }
    );
  }

  try {
    const payload = await montarPortalPublico(tipo, token);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    if (err instanceof PortalPublicoErro) {
      return NextResponse.json(
        {
          error: err.code || "indisponivel",
          message: err.message,
        },
        { status: err.status }
      );
    }
    console.error("[portal-publico]", err);
    return NextResponse.json(
      { error: "erro_interno", message: MENSAGEM_PORTAL_PUBLICO_INDISPONIVEL },
      { status: 500 }
    );
  }
});
