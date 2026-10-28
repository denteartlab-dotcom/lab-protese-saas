import { NextResponse } from "next/server";
import { exigirProprietario } from "@/lib/exigir-proprietario";
import { sincronizarStatusPagamentoAssinatura } from "@/lib/assinatura-pix-servidor";
import {
  gerarOuReusarPixTaxaAberturaSubconta,
  marcarCadastroSubcontaAberto,
  resumoTaxaAberturaSubconta,
} from "@/lib/taxa-abertura-subconta";

async function sincronizarTaxaPendente(empresaId: string) {
  const resumo = await resumoTaxaAberturaSubconta(empresaId);
  const cobranca = resumo.cobranca;
  if (!cobranca || cobranca.pago) return resumoTaxaAberturaSubconta(empresaId);
  try {
    await sincronizarStatusPagamentoAssinatura(cobranca.paymentId, "mercadopago");
  } catch (erro) {
    console.error("[asaas/subconta/taxa] sincronizar pix", erro);
  }
  return resumoTaxaAberturaSubconta(empresaId);
}

function sessaoDaTaxa(
  prop: Awaited<ReturnType<typeof exigirProprietario>>
) {
  if ("erro" in prop && prop.erro) return { erro: prop.erro, session: null };
  if (!("session" in prop)) {
    return {
      erro: NextResponse.json({ error: "Não autorizado." }, { status: 401 }),
      session: null,
    };
  }
  return { erro: null, session: prop.session };
}

export async function GET() {
  const acesso = sessaoDaTaxa(await exigirProprietario());
  if (acesso.erro || !acesso.session) return acesso.erro;

  try {
    const taxa = await sincronizarTaxaPendente(acesso.session.empresaId);
    return NextResponse.json({ ok: true, taxa });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Não foi possível consultar a taxa." },
      { status: 422 }
    );
  }
}

export async function POST(request: Request) {
  const acesso = sessaoDaTaxa(await exigirProprietario());
  if (acesso.erro || !acesso.session) return acesso.erro;
  const prop = acesso;

  let body: {
    marcarCadastroAberto?: boolean;
    onboardingUrl?: string | null;
    onboardingUrlExpiraEm?: string | null;
  } = {};
  try {
    const raw = await request.json();
    if (raw && typeof raw === "object") body = raw as typeof body;
  } catch {
    body = {};
  }

  try {
    if (body.marcarCadastroAberto) {
      await marcarCadastroSubcontaAberto(
        prop.session.empresaId,
        body.onboardingUrl,
        body.onboardingUrlExpiraEm
      );
      const taxa = await resumoTaxaAberturaSubconta(prop.session.empresaId);
      return NextResponse.json({ ok: true, taxa });
    }

    const taxa = await gerarOuReusarPixTaxaAberturaSubconta(
      prop.session.empresaId,
      prop.session.email
    );
    return NextResponse.json({ ok: true, taxa });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Não foi possível gerar o PIX da taxa." },
      { status: 422 }
    );
  }
}
