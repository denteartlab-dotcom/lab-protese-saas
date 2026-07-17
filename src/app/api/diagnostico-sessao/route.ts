import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { empresaTemAcessoAssinatura } from "@/lib/assinatura-empresa";
import { obterContextoAppServidor } from "@/lib/contexto-app-servidor";
import { carregarConfigLaboratorioServidor } from "@/lib/lab-config-servidor";
import { prisma, runWithRlsBypass, runWithTenantContext } from "@/lib/prisma-tenant";

/**
 * Diagnóstico do fluxo de login/app para o PRÓPRIO usuário logado.
 * Mostra qual checagem devolve null e derruba o /app para /login.
 */
export async function GET() {
  const out: Record<string, unknown> = {};

  const session = await getSession();
  out.session = session
    ? {
        id: session.id,
        empresaId: session.empresaId ?? null,
        empresaSlug: session.empresaSlug ?? null,
        assinaturaVencida: session.assinaturaVencida === true,
      }
    : null;
  if (!session) return NextResponse.json(out);

  const consulta = () =>
    prisma.user.findUnique({
      where: { id: session.id },
      select: {
        excluidoEm: true,
        empresaId: true,
        empresa: {
          select: { id: true, slug: true, status: true, dataVencimento: true },
        },
      },
    });

  if (session.empresaId) {
    try {
      const u = await runWithTenantContext(session.empresaId, consulta);
      out.userComTenant = u
        ? { excluidoEm: u.excluidoEm, empresa: u.empresa }
        : null;
    } catch (e) {
      out.userComTenantErro = String(e).slice(0, 300);
    }
  } else {
    out.userComTenant = "sessao sem empresaId";
  }

  try {
    const u = await runWithRlsBypass(consulta);
    out.userComBypass = u
      ? { excluidoEm: u.excluidoEm, empresa: u.empresa }
      : null;
    if (u?.empresa) {
      out.temAcessoAssinatura = empresaTemAcessoAssinatura(u.empresa);
      out.hoje = new Date().toISOString();
    }
  } catch (e) {
    out.userComBypassErro = String(e).slice(0, 300);
  }

  if (session.empresaId) {
    try {
      await runWithTenantContext(session.empresaId, () =>
        carregarConfigLaboratorioServidor(session.empresaId)
      );
      out.configLab = "ok";
    } catch (e) {
      out.configLabErro = String(e).slice(0, 300);
    }
  }

  try {
    const ctx = await obterContextoAppServidor();
    out.contextoApp = ctx ? "ok" : null;
  } catch (e) {
    out.contextoAppErro = String(e).slice(0, 300);
  }

  return NextResponse.json(out);
}
