import { getSession } from "@/lib/auth";
import {
  empresaPrecisaPaginaRenovacao,
  empresaTemAcessoAssinatura,
  formatarDataAssinatura,
  statusPagamentoAssinatura,
} from "@/lib/assinatura-empresa";
import { prisma } from "@/lib/db";
import { lerJsonStoreTenant } from "@/lib/json-store-tenant";
import {
  normalizarPeriodoCobranca,
  PERIODO_ASSINATURA_STORAGE_KEY,
  rotuloPlanoEmpresa,
  type PeriodoCobranca,
} from "@/lib/master-planos";

export type ContextoAssinaturaVencida = {
  user: {
    id: string;
    name: string;
    email: string;
  };
  empresa: {
    id: string;
    slug: string;
    nome: string;
    plano: string;
    planoRotulo: string;
    dataVencimento: string | null;
    dataVencimentoFormatada: string;
    statusPagamento: string;
  };
  periodoCobrancaPreferido: PeriodoCobranca;
  suporteWhatsapp: string | null;
};

export async function obterContextoAssinaturaVencida(): Promise<ContextoAssinaturaVencida | null> {
  const session = await getSession();
  if (!session?.empresaId) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      name: true,
      email: true,
      excluidoEm: true,
      empresa: {
        select: {
          id: true,
          nome: true,
          slug: true,
          plano: true,
          status: true,
          dataVencimento: true,
        },
      },
    },
  });

  if (!user || user.excluidoEm || !user.empresa) return null;
  if (!empresaPrecisaPaginaRenovacao(user.empresa)) return null;

  const periodoSalvo = await lerJsonStoreTenant<string>(
    user.empresa.id,
    PERIODO_ASSINATURA_STORAGE_KEY
  );

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    empresa: {
      id: user.empresa.id,
      slug: user.empresa.slug,
      nome: user.empresa.nome,
      plano: user.empresa.plano,
      planoRotulo: rotuloPlanoEmpresa(user.empresa.plano),
      dataVencimento: user.empresa.dataVencimento?.toISOString() ?? null,
      dataVencimentoFormatada: formatarDataAssinatura(user.empresa.dataVencimento),
      statusPagamento: statusPagamentoAssinatura(user.empresa),
    },
    periodoCobrancaPreferido: normalizarPeriodoCobranca(periodoSalvo || "mensal"),
    suporteWhatsapp: process.env.SUPPORT_WHATSAPP?.trim() || null,
  };
}

export async function obterDestinoPosLogin(sessionEmpresaId: string): Promise<string> {
  const empresa = await prisma.empresa.findUnique({
    where: { id: sessionEmpresaId },
    select: { slug: true, status: true, dataVencimento: true },
  });
  if (!empresa) return "/login";
  if (empresaPrecisaPaginaRenovacao(empresa)) return "/assinatura-vencida";
  if (!empresaTemAcessoAssinatura(empresa)) return "/login";
  return empresa.slug ? `/app/${empresa.slug}` : "/app";
}
