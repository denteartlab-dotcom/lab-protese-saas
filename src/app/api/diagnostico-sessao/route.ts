import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { empresaTemAcessoAssinatura } from "@/lib/assinatura-empresa";
import { obterContextoAppServidor } from "@/lib/contexto-app-servidor";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { carregarConfigLaboratorioServidor } from "@/lib/lab-config-servidor";
import {
  executarComTenant,
  executarSemRls,
  prisma,
  runWithRlsBypass,
  runWithTenantContext,
} from "@/lib/prisma-tenant";

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

  // Testa a visibilidade dos DADOS (Trabalho/Lancamento/JsonStore) nos 3 caminhos
  // que as rotas de produção/financeiro usam — mostra onde o RLS fica cego.
  if (session.empresaId) {
    const empresaId = session.empresaId;

    try {
      const [t, l] = await executarComTenant(empresaId, async (tx) => {
        const trabalhos = await tx.trabalho.count({ where: { empresaId } });
        const lancamentos = await tx.lancamento.count({ where: { empresaId } });
        return [trabalhos, lancamentos];
      });
      out.dadosTxTenant = { trabalhos: t, lancamentos: l };
    } catch (e) {
      out.dadosTxTenantErro = String(e).slice(0, 300);
    }

    try {
      const t = await executarSemRls((tx) =>
        tx.trabalho.count({ where: { empresaId } })
      );
      out.dadosTxBypass = { trabalhos: t };
    } catch (e) {
      out.dadosTxBypassErro = String(e).slice(0, 300);
    }

    try {
      const t = await runWithTenantContext(empresaId, () =>
        prisma.trabalho.count({ where: { empresaId } })
      );
      out.dadosExtensaoTenant = { trabalhos: t };
    } catch (e) {
      out.dadosExtensaoTenantErro = String(e).slice(0, 300);
    }

    try {
      const ctxEmpresa = await requireEmpresaContext();
      // Mesmo caminho do GET /api/trabalhos: enterWith + cliente estendido.
      const t = await prisma.trabalho.count({
        where: { empresaId: ctxEmpresa.empresaId },
      });
      const j = await prisma.jsonStore.count({
        where: { key: { startsWith: `t:${ctxEmpresa.empresaId}:` } },
      });
      out.dadosComoRotaTrabalhos = {
        empresaIdCtx: ctxEmpresa.empresaId,
        trabalhos: t,
        jsonStore: j,
      };
    } catch (e) {
      out.dadosComoRotaTrabalhosErro = String(e).slice(0, 300);
    }
  }

  return NextResponse.json(out);
}
