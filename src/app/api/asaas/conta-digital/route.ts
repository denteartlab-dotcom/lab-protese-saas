import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  obterExtratoContaDigital,
  obterSaldoContaDigital,
  pagarBoletoContaDigital,
  transferirPixContaDigital,
  validarBoletoContaDigital,
} from "@/lib/asaas-conta-digital";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.empresaId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const acao = searchParams.get("acao");

  try {
    if (acao === "extrato") {
      const movimentacoes = await obterExtratoContaDigital(session.empresaId, {
        startDate: searchParams.get("inicio") || undefined,
        finishDate: searchParams.get("fim") || undefined,
        offset: Number(searchParams.get("offset") || "0") || 0,
        limit: Number(searchParams.get("limit") || "50") || 50,
      });
      return NextResponse.json({ movimentacoes });
    }

    const { saldo } = await obterSaldoContaDigital(session.empresaId);
    return NextResponse.json({ saldo });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro na conta digital." },
      { status: 422 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.empresaId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      acao?: string;
      linhaDigitavel?: string;
      descricao?: string;
      agendarPara?: string;
      valor?: number;
      chavePix?: string;
      tipoChave?: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";
    };

    if (body.acao === "validar-boleto") {
      if (!body.linhaDigitavel?.trim()) {
        return NextResponse.json({ error: "Informe a linha digitável." }, { status: 400 });
      }
      const boleto = await validarBoletoContaDigital(
        session.empresaId,
        body.linhaDigitavel
      );
      return NextResponse.json({ boleto });
    }

    if (body.acao === "pagar-boleto") {
      if (!body.linhaDigitavel?.trim()) {
        return NextResponse.json({ error: "Informe a linha digitável." }, { status: 400 });
      }
      const pagamento = await pagarBoletoContaDigital(session.empresaId, {
        linhaDigitavel: body.linhaDigitavel,
        descricao: body.descricao,
        agendarPara: body.agendarPara,
      });
      return NextResponse.json({ pagamento });
    }

    if (body.acao === "transferir-pix") {
      if (!body.chavePix?.trim() || !body.tipoChave) {
        return NextResponse.json({ error: "Informe chave Pix e tipo." }, { status: 400 });
      }
      const valor = Number(body.valor);
      if (!Number.isFinite(valor) || valor <= 0) {
        return NextResponse.json({ error: "Informe um valor válido." }, { status: 400 });
      }
      const transferencia = await transferirPixContaDigital(session.empresaId, {
        valor,
        chavePix: body.chavePix,
        tipoChave: body.tipoChave,
        descricao: body.descricao,
      });
      return NextResponse.json({ transferencia });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Operação não concluída." },
      { status: 422 }
    );
  }
}
