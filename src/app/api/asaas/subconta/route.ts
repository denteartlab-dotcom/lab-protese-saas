import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import {
  criarSubcontaEmpresa,
  encerrarSubcontaEmpresa,
  listarDocumentosSubconta,
  listarDocumentosSubcontaParaEnvio,
  nenhumDocumentoEnviadoSubconta,
  obterSubcontaEmpresa,
  sincronizarStatusSubconta,
} from "@/lib/asaas-subconta";
import { montarSubcontaPainelContaDigital } from "@/lib/asaas-conta-digital";
import { exigirProprietario } from "@/lib/exigir-proprietario";
import { negarSeSemPermissao } from "@/lib/require-permissao";
import {
  marcarCadastroSubcontaAberto,
  resumoTaxaAberturaSubconta,
  taxaAberturaSubcontaPaga,
} from "@/lib/taxa-abertura-subconta";

export async function GET() {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const negado = await negarSeSemPermissao(ctx, "configuracoes-boletos", "ver");
  if (negado) return negado;

  try {
    let sub = await obterSubcontaEmpresa(ctx.empresaId);
    if (sub?.apiKey) {
      sub = await sincronizarStatusSubconta(ctx.empresaId);
    }

    let documentos: Awaited<ReturnType<typeof listarDocumentosSubconta>> = [];
    if (sub?.apiKey && sub.status !== "aprovada") {
      try {
        documentos = await listarDocumentosSubconta(ctx.empresaId);
      } catch {
        documentos = [];
      }
    }

    // Conta aberta sem documento enviado: a tela volta a mostrar Abrir conta.
    // O clique retoma o envio; a subconta não é encerrada ao sair da página.
    const envioDocumentosPendente =
      Boolean(sub?.apiKey) &&
      sub?.status === "pendente_documentos" &&
      nenhumDocumentoEnviadoSubconta(documentos);

    const subconta = await montarSubcontaPainelContaDigital(ctx.empresaId);
    const taxaAbertura = await resumoTaxaAberturaSubconta(ctx.empresaId);

    return NextResponse.json({
      subconta: { ...subconta, envioDocumentosPendente },
      taxaAbertura,
      documentos: documentos.map((doc) => ({
        id: doc.id,
        type: doc.type,
        title: doc.title,
        description: doc.description,
        status: doc.status,
        onboardingUrl: doc.onboardingUrl || null,
        onboardingUrlExpirationDate: doc.onboardingUrlExpirationDate || null,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao consultar conta digital." },
      { status: 500 }
    );
  }
}

export async function POST() {
  const prop = await exigirProprietario();
  if (prop.erro) return prop.erro;
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const existente = await obterSubcontaEmpresa(ctx.empresaId);
    if (!existente?.apiKey) {
      const taxaPaga = await taxaAberturaSubcontaPaga(ctx.empresaId);
      if (!taxaPaga) {
        return NextResponse.json(
          {
            error:
              "Pague a taxa única de R$ 15,00 para abrir a conta digital. O PIX usa o Mercado Pago da assinatura.",
          },
          { status: 422 }
        );
      }
    }

    await criarSubcontaEmpresa(ctx.empresaId);
    let documentos: Awaited<ReturnType<typeof listarDocumentosSubconta>> = [];
    try {
      documentos = await listarDocumentosSubcontaParaEnvio(ctx.empresaId);
    } catch {
      documentos = [];
    }

    const linkCadastro = documentos.find((doc) => doc.onboardingUrl);
    if (linkCadastro?.onboardingUrl) {
      try {
        await marcarCadastroSubcontaAberto(
          ctx.empresaId,
          linkCadastro.onboardingUrl,
          linkCadastro.onboardingUrlExpirationDate || null
        );
      } catch (erro) {
        console.error("[asaas/subconta] salvar link de cadastro", erro);
      }
    }

    return NextResponse.json(
      {
        subconta: await montarSubcontaPainelContaDigital(ctx.empresaId),
        documentos: documentos.map((doc) => ({
          id: doc.id,
          type: doc.type,
          title: doc.title,
          description: doc.description,
          status: doc.status,
          onboardingUrl: doc.onboardingUrl || null,
          onboardingUrlExpirationDate: doc.onboardingUrlExpirationDate || null,
        })),
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Não foi possível abrir a conta digital." },
      { status: 422 }
    );
  }
}

export async function DELETE(request: Request) {
  const prop = await exigirProprietario();
  if (prop.erro) return prop.erro;
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    let motivo: string | undefined;
    try {
      const body = (await request.json()) as { motivo?: string };
      motivo = typeof body?.motivo === "string" ? body.motivo : undefined;
    } catch {
      motivo = undefined;
    }

    await encerrarSubcontaEmpresa(ctx.empresaId, { motivo });
    return NextResponse.json({
      ok: true,
      subconta: await montarSubcontaPainelContaDigital(ctx.empresaId),
      documentos: [],
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Não foi possível cancelar a conta digital.",
      },
      { status: 422 }
    );
  }
}
