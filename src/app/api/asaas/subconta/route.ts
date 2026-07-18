import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import {
  criarSubcontaEmpresa,
  listarDocumentosSubconta,
  obterSubcontaEmpresa,
  sincronizarStatusSubconta,
} from "@/lib/asaas-subconta";
import { montarSubcontaPainelContaDigital } from "@/lib/asaas-conta-digital";
import { exigirProprietario } from "@/lib/exigir-proprietario";
import { negarSeSemPermissao } from "@/lib/require-permissao";

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

    return NextResponse.json({
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
    await criarSubcontaEmpresa(ctx.empresaId);
    let documentos: Awaited<ReturnType<typeof listarDocumentosSubconta>> = [];
    try {
      documentos = await listarDocumentosSubconta(ctx.empresaId);
    } catch {
      documentos = [];
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
