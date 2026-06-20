import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { requireEmpresaContextRenovacao } from "@/lib/empresa-context";
import { PLANOS_EMPRESA, PERIODOS_COBRANCA } from "@/lib/master-planos";
import { atualizarSessaoAssinaturaUsuario } from "@/lib/sessao-assinatura";
import {
  consultarCobrancaPixAssinatura,
  gerarCobrancaPixRenovacao,
  resolverEmpresaIdParaRenovacao,
  sincronizarStatusPagamentoAssinatura,
} from "@/lib/assinatura-pix-servidor";

const bodySchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(1).optional(),
  empresaSlug: z.string().min(1).optional(),
  plano: z.enum(PLANOS_EMPRESA).optional(),
  periodo: z.enum(PERIODOS_COBRANCA).optional(),
  force: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    let body: z.infer<typeof bodySchema> = {};
    try {
      const raw = await request.json();
      body = bodySchema.parse(raw);
    } catch {
      if (!session?.empresaId) {
        return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
      }
    }

    const empresaId = await resolverEmpresaIdParaRenovacao({
      sessionEmpresaId: session?.empresaId,
      email: body.email,
      password: body.password,
      empresaSlug: body.empresaSlug,
    });

    const cobranca = await gerarCobrancaPixRenovacao(empresaId, body.plano, {
      emailPagador: session?.email || body.email,
      forcarNova: body.force === true,
      periodo: body.periodo,
    });
    return NextResponse.json({ ok: true, cobranca });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro ao gerar PIX.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const cobrancaId = new URL(request.url).searchParams.get("cobrancaId")?.trim();
  if (!cobrancaId) {
    return NextResponse.json({ error: "Informe cobrancaId." }, { status: 400 });
  }

  try {
    let empresaId: string | undefined;
    try {
      const ctx = await requireEmpresaContextRenovacao();
      empresaId = ctx.empresaId;
    } catch {
      /* login bloqueado sem sessão ativa no fluxo legado */
    }

    let cobranca = await consultarCobrancaPixAssinatura(cobrancaId, empresaId);

    if (!cobranca) {
      return NextResponse.json({ error: "Cobrança não encontrada." }, { status: 404 });
    }

    if (!cobranca.pago) {
      try {
        await sincronizarStatusPagamentoAssinatura(
          cobranca.paymentId,
          cobranca.provedor
        );
        cobranca =
          (await consultarCobrancaPixAssinatura(cobrancaId, empresaId)) ?? cobranca;
      } catch {
        /* webhook ou próxima consulta */
      }
    }

    if (cobranca.pago && cobranca.renovadoEm) {
      const session = await getSession();
      if (session?.id) {
        await atualizarSessaoAssinaturaUsuario(session.id);
      }
    }

    return NextResponse.json({ ok: true, cobranca });
  } catch {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
}
