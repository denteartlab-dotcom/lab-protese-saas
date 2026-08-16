import { NextResponse } from "next/server";
import {
  anexarCookieSessao,
  SESSAO_TTL_SUPORTE_MASTER_S,
  type SessionUser,
} from "@/lib/auth";
import { empresaTemAcessoAssinatura } from "@/lib/assinatura-empresa";
import { exigirMasterAdmin, respostaNaoAutorizadoMaster } from "@/lib/exigir-master-admin";
import { ipDaRequisicao, registrarLogMaster } from "@/lib/master-audit";
import { executarSemRls } from "@/lib/prisma-tenant";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { master } = await exigirMasterAdmin();
    const { id } = await params;

    const empresa = await executarSemRls((tx) =>
      tx.empresa.findUnique({
        where: { id },
        select: {
          id: true,
          nome: true,
          slug: true,
          status: true,
          dataVencimento: true,
        },
      })
    );

    if (!empresa) {
      return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
    }

    if (empresa.status !== "ativo" || !empresaTemAcessoAssinatura(empresa)) {
      return NextResponse.json(
        { error: "Somente empresas ativas com assinatura válida podem ser visualizadas." },
        { status: 400 }
      );
    }

    const proprietario = await executarSemRls((tx) =>
      tx.user.findFirst({
        where: {
          empresaId: id,
          excluidoEm: null,
          role: { in: ["proprietario", "admin", "admin_empresa"] },
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          sessionVersion: true,
        },
      })
    );

    if (!proprietario) {
      return NextResponse.json(
        { error: "Nenhum proprietário ativo encontrado nesta empresa." },
        { status: 404 }
      );
    }

    const suporteExpiraEm = Date.now() + SESSAO_TTL_SUPORTE_MASTER_S * 1000;
    const sessionUser: SessionUser = {
      id: proprietario.id,
      name: proprietario.name,
      email: proprietario.email,
      role: proprietario.role,
      empresaId: empresa.id,
      empresaSlug: empresa.slug,
      empresaNome: empresa.nome,
      assinaturaVencida: false,
      sessionVersion: proprietario.sessionVersion ?? 0,
      suporteMaster: true,
      somenteLeitura: true,
      masterId: master.id,
      suporteExpiraEm,
    };

    await registrarLogMaster(master.id, "INICIAR_VISUALIZACAO_EMPRESA", {
      empresaId: empresa.id,
      detalhes: `Visualização somente leitura iniciada: ${empresa.nome} (${empresa.slug})`,
      ip: ipDaRequisicao(request),
    });

    const response = NextResponse.json({
      ok: true,
      empresa: {
        id: empresa.id,
        nome: empresa.nome,
        slug: empresa.slug,
      },
      redirectTo: `/app/${empresa.slug}`,
      expiraEm: new Date(suporteExpiraEm).toISOString(),
    });

    return anexarCookieSessao(response, sessionUser, {
      request,
      ttlSegundos: SESSAO_TTL_SUPORTE_MASTER_S,
    });
  } catch {
    return respostaNaoAutorizadoMaster();
  }
}
