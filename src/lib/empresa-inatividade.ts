import { empresaTemAcessoAssinatura } from "@/lib/assinatura-empresa";
import { whereCobrancaAssinaturaPagaTotal } from "@/lib/faturamento-assinatura-master";
import { prisma } from "@/lib/db";

export const DIAS_INATIVIDADE_PARA_EXCLUSAO = 30;

export type EmpresaParaAvaliarInatividade = {
  id: string;
  slug: string;
  nome: string;
  status: string;
  dataVencimento: Date | null;
  ultimoAcessoEm: Date | null;
  createdAt: Date;
};

function slugProtegidoExclusao(slug: string): boolean {
  const protegido = process.env.EMPRESA_SLUG_PADRAO?.trim().toLowerCase();
  if (!protegido) return false;
  return slug.trim().toLowerCase() === protegido;
}

export async function empresaJaComprouAssinatura(empresaId: string): Promise<boolean> {
  const pagas = await prisma.cobrancaAssinatura.count({
    where: {
      empresaId,
      ...whereCobrancaAssinaturaPagaTotal(),
    },
  });
  return pagas > 0;
}

export function diasDesdeUltimoAcessoEmpresa(empresa: {
  ultimoAcessoEm: Date | null;
  createdAt: Date;
}): number {
  const referencia = empresa.ultimoAcessoEm ?? empresa.createdAt;
  return Math.floor((Date.now() - referencia.getTime()) / 86_400_000);
}

export async function empresaElegivelExclusaoInatividade(
  empresa: EmpresaParaAvaliarInatividade
): Promise<boolean> {
  if (slugProtegidoExclusao(empresa.slug)) return false;
  if (empresaTemAcessoAssinatura(empresa)) return false;
  if (await empresaJaComprouAssinatura(empresa.id)) return false;
  return diasDesdeUltimoAcessoEmpresa(empresa) >= DIAS_INATIVIDADE_PARA_EXCLUSAO;
}

export async function listarEmpresasElegiveisExclusaoInatividade() {
  const candidatas = await prisma.empresa.findMany({
    select: {
      id: true,
      slug: true,
      nome: true,
      codigo: true,
      status: true,
      dataVencimento: true,
      ultimoAcessoEm: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const elegiveis: Array<(typeof candidatas)[number]> = [];
  for (const empresa of candidatas) {
    if (await empresaElegivelExclusaoInatividade(empresa)) {
      elegiveis.push(empresa);
    }
  }
  return elegiveis;
}
