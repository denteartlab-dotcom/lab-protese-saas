import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  obterExtratoContaDigital,
  obterSaldoContaDigital,
  pagarBoletoContaDigital,
  resolverContaDigitalOperacional,
  transferirPixContaDigital,
  validarBoletoContaDigital,
} from "@/lib/asaas-conta-digital";
import { exigirProprietario } from "@/lib/exigir-proprietario";
import { verificarSenhaProprietario } from "@/lib/seguranca-restaurar-padrao";
import {
  montarResumoLimitePix,
  registrarPixTransferidoContaDigital,
  salvarConfigLimitePixContaDigital,
  validarLimitePixDiarioContaDigital,
} from "@/lib/conta-digital-pix-limite";
import { invalidarCachePainelFinanceiro } from "@/lib/financeiro-painel-cache";
import {
  criarAutorizacaoPixSubconta,
  vincularTransferenciaAsaas,
} from "@/lib/seguranca-pix-subconta";

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
      senhaProprietario?: string;
      limiteDiario?: number | null;
      limiteAtivo?: boolean;
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

    if (body.acao === "salvar-limite-pix") {
      const prop = await exigirProprietario();
      if (prop.erro) return prop.erro;

      const limiteRaw = body.limiteDiario;
      const limiteDiario =
        limiteRaw == null || limiteRaw === 0
          ? null
          : Number(limiteRaw);
      if (limiteDiario != null && (!Number.isFinite(limiteDiario) || limiteDiario < 0)) {
        return NextResponse.json({ error: "Informe um limite válido." }, { status: 400 });
      }

      const config = await salvarConfigLimitePixContaDigital(session.empresaId, {
        ativo: Boolean(body.limiteAtivo),
        limiteDiario,
      });
      invalidarCachePainelFinanceiro(session.empresaId, "conta-digital");
      return NextResponse.json({ limitePix: montarResumoLimitePix(config) });
    }

    if (body.acao === "transferir-pix") {
      if (!body.chavePix?.trim() || !body.tipoChave) {
        return NextResponse.json({ error: "Informe chave Pix e tipo." }, { status: 400 });
      }
      const valor = Number(body.valor);
      if (!Number.isFinite(valor) || valor <= 0) {
        return NextResponse.json({ error: "Informe um valor válido." }, { status: 400 });
      }

      await validarLimitePixDiarioContaDigital(session.empresaId, valor);

      const { modo } = await resolverContaDigitalOperacional(session.empresaId);
      let pendingId: string | undefined;

      if (modo === "subconta") {
        const prop = await exigirProprietario();
        if (prop.erro) return prop.erro;

        const senha = body.senhaProprietario?.trim() || "";
        if (!senha) {
          return NextResponse.json(
            { error: "Informe a senha do proprietário para autorizar o Pix." },
            { status: 400 }
          );
        }
        const senhaOk = await verificarSenhaProprietario(prop.session.id, senha);
        if (!senhaOk) {
          return NextResponse.json(
            { error: "Senha do proprietário incorreta." },
            { status: 403 }
          );
        }

        pendingId = await criarAutorizacaoPixSubconta({
          empresaId: session.empresaId,
          usuarioId: prop.session.id,
          valor,
          chavePix: body.chavePix,
          tipoChave: body.tipoChave,
        });
      }

      const transferencia = await transferirPixContaDigital(session.empresaId, {
        valor,
        chavePix: body.chavePix,
        tipoChave: body.tipoChave,
        descricao: body.descricao,
      });

      if (pendingId && transferencia?.id) {
        await vincularTransferenciaAsaas(pendingId, transferencia.id);
      }

      const limitePix = await registrarPixTransferidoContaDigital(session.empresaId, valor);
      invalidarCachePainelFinanceiro(session.empresaId, "conta-digital");

      return NextResponse.json({ transferencia, limitePix });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Operação não concluída." },
      { status: 422 }
    );
  }
}
