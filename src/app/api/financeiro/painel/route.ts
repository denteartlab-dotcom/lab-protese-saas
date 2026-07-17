import { NextResponse } from "next/server";
import { medirHandlerApi } from "@/lib/api-observabilidade";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { negarSeSemPermissao } from "@/lib/require-permissao";
import {
  gravarCachePainelFinanceiro,
  lerCachePainelFinanceiro,
} from "@/lib/financeiro-painel-cache";
import {
  montarPainelFinanceiro,
  type AbaPainelFinanceiro,
} from "@/lib/financeiro-painel-server";
import { ABAS_PAINEL_FINANCEIRO } from "@/lib/financeiro-painel-types";

function abaSuportada(valor: string): valor is AbaPainelFinanceiro {
  return (ABAS_PAINEL_FINANCEIRO as readonly string[]).includes(valor);
}

function moduloDaAbaPainel(aba: AbaPainelFinanceiro): string {
  switch (aba) {
    case "despesa":
      return "financeiro-tipo-despesa";
    case "boletos":
      return "financeiro-aba-boletos";
    case "plano-de-contas":
      return "financeiro-aba-plano-de-contas";
    case "conta-bancaria":
    case "conta-digital":
      return "financeiro-aba-conta-bancaria";
    default:
      return "financeiro-tipo-receita";
  }
}

export const GET = medirHandlerApi("/api/financeiro/painel", async function GET(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const abaParam = searchParams.get("aba") || "receita";
  const semCache = searchParams.get("refresh") === "1";

  if (!abaSuportada(abaParam)) {
    return NextResponse.json(
      { error: `Aba não suportada. Use: ${ABAS_PAINEL_FINANCEIRO.join(", ")}` },
      { status: 400 }
    );
  }

  const aba = abaParam;
  const negado = await negarSeSemPermissao(ctx, moduloDaAbaPainel(aba), "ver");
  if (negado) return negado;
  const abaComSyncFixa = aba === "despesa" || aba === "boletos";

  try {
    if (!semCache && !abaComSyncFixa) {
      const emCache = lerCachePainelFinanceiro(ctx.empresaId, aba);
      if (emCache) {
        return NextResponse.json(emCache, {
          headers: { "X-Cache": "HIT" },
        });
      }
    }

    const dados = await montarPainelFinanceiro(ctx.empresaId, aba);

    if (!abaComSyncFixa) {
      gravarCachePainelFinanceiro(ctx.empresaId, aba, dados);
    }

    return NextResponse.json(dados, {
      headers: { "X-Cache": abaComSyncFixa ? "BYPASS" : semCache ? "REFRESH" : "MISS" },
    });
  } catch (err) {
    console.error("[financeiro/painel GET]", err);
    return NextResponse.json(
      { error: "Erro ao carregar painel financeiro." },
      { status: 500 }
    );
  }
});
