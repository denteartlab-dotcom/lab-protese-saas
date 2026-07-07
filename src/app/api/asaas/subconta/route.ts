import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  criarSubcontaEmpresa,
  listarDocumentosSubconta,
  obterSubcontaEmpresa,
  sincronizarStatusSubconta,
} from "@/lib/asaas-subconta";
import { montarSubcontaPainelContaDigital } from "@/lib/asaas-conta-digital";

export async function GET() {
  const session = await getSession();
  if (!session?.empresaId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    let sub = await obterSubcontaEmpresa(session.empresaId);
    if (sub?.apiKey) {
      sub = await sincronizarStatusSubconta(session.empresaId);
    }

    let documentos: Awaited<ReturnType<typeof listarDocumentosSubconta>> = [];
    if (sub?.apiKey && sub.status !== "aprovada") {
      try {
        documentos = await listarDocumentosSubconta(session.empresaId);
      } catch {
        documentos = [];
      }
    }

    return NextResponse.json({
      subconta: await montarSubcontaPainelContaDigital(session.empresaId),
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
  const session = await getSession();
  if (!session?.empresaId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    await criarSubcontaEmpresa(session.empresaId);
    let documentos: Awaited<ReturnType<typeof listarDocumentosSubconta>> = [];
    try {
      documentos = await listarDocumentosSubconta(session.empresaId);
    } catch {
      documentos = [];
    }

    return NextResponse.json(
      {
        subconta: await montarSubcontaPainelContaDigital(session.empresaId),
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
