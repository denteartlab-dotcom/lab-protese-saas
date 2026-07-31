import { empresaTemAcessoAssinatura } from "@/lib/assinatura-empresa";
import { whereCobrancaAssinaturaPagaTotal } from "@/lib/faturamento-assinatura-master";
import { executarSemRls } from "@/lib/db";

/** Dias sem acesso (e sem assinatura paga) para excluir a conta. */
export const DIAS_INATIVIDADE_PARA_EXCLUSAO = 30;
/** Dias de antecedência do e-mail de aviso antes da exclusão. */
export const DIAS_AVISO_INATIVIDADE_ANTES = 3;

export type EmpresaParaAvaliarInatividade = {
  id: string;
  slug: string;
  nome: string;
  email: string | null;
  status: string;
  dataVencimento: Date | null;
  ultimoAcessoEm: Date | null;
  avisoInatividadeEnviadoEm: Date | null;
  createdAt: Date;
};

function slugProtegidoExclusao(slug: string): boolean {
  const protegido = process.env.EMPRESA_SLUG_PADRAO?.trim().toLowerCase();
  if (!protegido) return false;
  return slug.trim().toLowerCase() === protegido;
}

export async function empresaJaComprouAssinatura(empresaId: string): Promise<boolean> {
  const pagas = await executarSemRls((tx) =>
    tx.cobrancaAssinatura.count({
      where: {
        empresaId,
        ...whereCobrancaAssinaturaPagaTotal(),
      },
    })
  );
  return pagas > 0;
}

export function diasDesdeUltimoAcessoEmpresa(empresa: {
  ultimoAcessoEm: Date | null;
  createdAt: Date;
}): number {
  const referencia = empresa.ultimoAcessoEm ?? empresa.createdAt;
  return Math.floor((Date.now() - referencia.getTime()) / 86_400_000);
}

function diasDesdeAviso(avisoEm: Date | null): number {
  if (!avisoEm) return -1;
  return Math.floor((Date.now() - avisoEm.getTime()) / 86_400_000);
}

async function empresaCandidataInatividadeBase(
  empresa: EmpresaParaAvaliarInatividade
): Promise<boolean> {
  if (slugProtegidoExclusao(empresa.slug)) return false;
  if (empresaTemAcessoAssinatura(empresa)) return false;
  if (await empresaJaComprouAssinatura(empresa.id)) return false;
  return true;
}

/** Elegível para e-mail de aviso (faltam ~3 dias para a exclusão). */
export async function empresaElegivelAvisoInatividade(
  empresa: EmpresaParaAvaliarInatividade
): Promise<boolean> {
  if (!(await empresaCandidataInatividadeBase(empresa))) return false;
  if (empresa.avisoInatividadeEnviadoEm) return false;
  const dias = diasDesdeUltimoAcessoEmpresa(empresa);
  const limiarAviso = DIAS_INATIVIDADE_PARA_EXCLUSAO - DIAS_AVISO_INATIVIDADE_ANTES;
  return dias >= limiarAviso;
}

/**
 * Exclui só se já passou o prazo de inatividade e o cliente foi avisado
 * com pelo menos DIAS_AVISO_INATIVIDADE_ANTES de antecedência.
 */
export async function empresaElegivelExclusaoInatividade(
  empresa: EmpresaParaAvaliarInatividade
): Promise<boolean> {
  if (!(await empresaCandidataInatividadeBase(empresa))) return false;
  const dias = diasDesdeUltimoAcessoEmpresa(empresa);
  if (dias < DIAS_INATIVIDADE_PARA_EXCLUSAO) return false;
  if (!empresa.avisoInatividadeEnviadoEm) return false;
  return diasDesdeAviso(empresa.avisoInatividadeEnviadoEm) >= DIAS_AVISO_INATIVIDADE_ANTES;
}

const selectEmpresaInatividade = {
  id: true,
  slug: true,
  nome: true,
  email: true,
  codigo: true,
  status: true,
  dataVencimento: true,
  ultimoAcessoEm: true,
  avisoInatividadeEnviadoEm: true,
  createdAt: true,
} as const;

async function listarCandidatasInatividade() {
  return executarSemRls((tx) =>
    tx.empresa.findMany({
      select: selectEmpresaInatividade,
      orderBy: { createdAt: "asc" },
    })
  );
}

export async function listarEmpresasElegiveisAvisoInatividade() {
  const candidatas = await listarCandidatasInatividade();
  const elegiveis: Array<(typeof candidatas)[number]> = [];
  for (const empresa of candidatas) {
    if (await empresaElegivelAvisoInatividade(empresa)) {
      elegiveis.push(empresa);
    }
  }
  return elegiveis;
}

export async function listarEmpresasElegiveisExclusaoInatividade() {
  const candidatas = await listarCandidatasInatividade();
  const elegiveis: Array<(typeof candidatas)[number]> = [];
  for (const empresa of candidatas) {
    if (await empresaElegivelExclusaoInatividade(empresa)) {
      elegiveis.push(empresa);
    }
  }
  return elegiveis;
}

export async function marcarAvisoInatividadeEnviado(empresaId: string) {
  await executarSemRls((tx) =>
    tx.empresa.update({
      where: { id: empresaId },
      data: { avisoInatividadeEnviadoEm: new Date() },
    })
  );
}

/** E-mail do proprietário (ou e-mail da empresa) para o aviso. */
export async function resolverEmailAvisoInatividade(empresa: {
  id: string;
  email: string | null;
}): Promise<{ email: string; nome: string } | null> {
  const usuario = await executarSemRls((tx) =>
    tx.user.findFirst({
      where: {
        empresaId: empresa.id,
        excluidoEm: null,
        role: { in: ["proprietario", "admin", "admin_empresa"] },
      },
      orderBy: { createdAt: "asc" },
      select: { email: true, name: true },
    })
  );
  const email = (usuario?.email || empresa.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return null;
  return { email, nome: usuario?.name?.trim() || "Cliente" };
}

export function dataExclusaoPrevistaAviso(empresa: {
  ultimoAcessoEm: Date | null;
  createdAt: Date;
  avisoInatividadeEnviadoEm?: Date | null;
}): Date {
  const referencia = empresa.ultimoAcessoEm ?? empresa.createdAt;
  const porInatividade = new Date(referencia);
  porInatividade.setDate(porInatividade.getDate() + DIAS_INATIVIDADE_PARA_EXCLUSAO);

  const avisoBase = empresa.avisoInatividadeEnviadoEm ?? new Date();
  const porAviso = new Date(avisoBase);
  porAviso.setDate(porAviso.getDate() + DIAS_AVISO_INATIVIDADE_ANTES);

  return new Date(Math.max(porInatividade.getTime(), porAviso.getTime()));
}
