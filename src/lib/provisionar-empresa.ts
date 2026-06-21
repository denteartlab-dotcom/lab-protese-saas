import { hashPassword } from "@/lib/auth";
import { calcularDataVencimentoAssinatura } from "@/lib/assinatura-empresa";
import { gravarDadosPadraoEmpresa, validarSlugEmpresa } from "@/lib/empresa-padrao";
import { prisma } from "@/lib/db";
import {
  DIAS_TESTE_GRATIS,
  limitesDoPlano,
  normalizarPeriodoCobranca,
  PERIODO_ASSINATURA_STORAGE_KEY,
} from "@/lib/master-planos";
import { salvarJsonStoreTenant } from "@/lib/json-store-tenant";
import { normalizarSlugEmpresa } from "@/lib/rotas-app";
import { validarCpfOuCnpj } from "@/lib/validar-documento";
import { validarForcaSenha } from "@/lib/validar-senha";
import { garantirPastasUploadEmpresa } from "@/lib/uploads-armazenamento-server";
import { garantirPastaDriveEmpresa } from "@/lib/backup-google-drive";

export const ROLE_PROPRIETARIO_EMPRESA = "proprietario";
/** @deprecated Use ROLE_PROPRIETARIO_EMPRESA */
export const ROLE_ADMIN_EMPRESA = ROLE_PROPRIETARIO_EMPRESA;

const EMAILS_MASTER_BLOQUEADOS = new Set([
  "admin@labprotese.com",
  "admin@labprote.com",
]);

export type DadosProvisionarEmpresa = {
  nome: string;
  slug?: string;
  responsavel: string;
  cnpj: string;
  telefone: string;
  whatsapp?: string;
  emailLaboratorio: string;
  cidade?: string;
  estado?: string;
  plano: string;
  periodoCobranca?: string;
  adminNome: string;
  adminEmail: string;
  adminSenha: string;
};

export type EmpresaProvisionada = {
  empresaId: string;
  codigo: string | null;
  slug: string;
  nome: string;
  adminId: string;
};

function gerarSlugDeNome(nome: string): string {
  const base = normalizarSlugEmpresa(
    nome
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );
  return base.length >= 3 ? base : "laboratorio";
}

async function gerarCodigoEmpresa(): Promise<string> {
  const total = await prisma.empresa.count();
  return `EMP-${String(total + 1).padStart(5, "0")}`;
}

export async function provisionarNovaEmpresa(
  dados: DadosProvisionarEmpresa
): Promise<EmpresaProvisionada> {
  const nome = dados.nome.trim();
  const responsavel = dados.responsavel.trim();
  const cnpj = dados.cnpj.trim();
  const telefone = dados.telefone.trim();
  const whatsapp = dados.whatsapp?.trim() || null;
  const emailLaboratorio = dados.emailLaboratorio.trim().toLowerCase();
  const cidade = dados.cidade?.trim() || null;
  const estado = dados.estado?.trim().toUpperCase() || null;
  const adminNome = dados.adminNome.trim();
  const adminEmail = dados.adminEmail.trim().toLowerCase();
  const adminSenha = dados.adminSenha;

  if (nome.length < 2) throw new Error("NOME_INVALIDO");
  if (responsavel.length < 2) throw new Error("RESPONSAVEL_INVALIDO");
  if (cnpj && !validarCpfOuCnpj(cnpj)) throw new Error("DOCUMENTO_INVALIDO");
  if (telefone.replace(/\D/g, "").length < 10) throw new Error("TELEFONE_INVALIDO");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLaboratorio)) throw new Error("EMAIL_LAB_INVALIDO");
  if (cidade && cidade.length < 2) throw new Error("CIDADE_INVALIDA");
  if (estado && estado.length !== 2) throw new Error("ESTADO_INVALIDO");
  if (adminNome.length < 2) throw new Error("ADMIN_NOME_INVALIDO");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) throw new Error("EMAIL_INVALIDO");

  if (EMAILS_MASTER_BLOQUEADOS.has(adminEmail) || EMAILS_MASTER_BLOQUEADOS.has(emailLaboratorio)) {
    throw new Error("EMAIL_RESERVADO");
  }

  const master = await prisma.masterUser.findUnique({ where: { email: adminEmail } });
  if (master) throw new Error("EMAIL_RESERVADO");

  const senhaCheck = validarForcaSenha(adminSenha);
  if (!senhaCheck.valida) throw new Error("SENHA_FRACA");

  let slug = dados.slug?.trim() ? validarSlugEmpresa(dados.slug) : gerarSlugDeNome(nome);
  if (!slug) throw new Error("SLUG_INVALIDO");

  const nomeEmUso = await prisma.empresa.findFirst({
    where: { nome: { equals: nome, mode: "insensitive" } },
  });
  if (nomeEmUso) throw new Error("LABORATORIO_EXISTE");

  const slugBase = slug;
  let tentativa = 0;
  while (await prisma.empresa.findUnique({ where: { slug } })) {
    tentativa += 1;
    slug = `${slugBase}-${tentativa}`;
    if (tentativa > 50) throw new Error("SLUG_EM_USO");
  }

  const planoTrial = "premium" as const;
  const limites = limitesDoPlano(planoTrial);
  const dataVencimentoTrial = calcularDataVencimentoAssinatura(DIAS_TESTE_GRATIS);
  const codigo = await gerarCodigoEmpresa();
  const password = await hashPassword(adminSenha);

  const resultado = await prisma.$transaction(async (tx) => {
    const empresa = await tx.empresa.create({
      data: {
        codigo,
        nome,
        slug,
        responsavel,
        cnpj,
        telefone,
        whatsapp,
        email: emailLaboratorio,
        cidade,
        estado,
        plano: planoTrial,
        limiteUsuarios: limites.usuarios,
        limiteTrabalhos: limites.trabalhos,
        status: "ativo",
        dataVencimento: dataVencimentoTrial,
        observacoes: `Teste grátis Premium por ${DIAS_TESTE_GRATIS} dias (cadastro público).`,
      },
    });

    const admin = await tx.user.create({
      data: {
        empresaId: empresa.id,
        name: adminNome,
        email: adminEmail,
        password,
        role: ROLE_PROPRIETARIO_EMPRESA,
      },
    });

    await tx.sequenciaNumerica.createMany({
      data: [
        { empresaId: empresa.id, chave: "numero_os", valor: 0 },
        { empresaId: empresa.id, chave: "numero_fatura_receita", valor: 0 },
        { empresaId: empresa.id, chave: "numero_pedido_orcamento", valor: 0 },
      ],
    });

    return { empresa, admin };
  });

  await gravarDadosPadraoEmpresa(resultado.empresa.id, nome);
  if (dados.periodoCobranca) {
    await salvarJsonStoreTenant(
      resultado.empresa.id,
      PERIODO_ASSINATURA_STORAGE_KEY,
      normalizarPeriodoCobranca(dados.periodoCobranca)
    );
  }
  await garantirPastasUploadEmpresa(resultado.empresa.slug);
  void garantirPastaDriveEmpresa({
    empresaId: resultado.empresa.id,
    slug: resultado.empresa.slug,
    nome: resultado.empresa.nome,
  }).catch((erro) => {
    console.warn("[provisionar-empresa] pasta Drive:", erro);
  });

  return {
    empresaId: resultado.empresa.id,
    codigo: resultado.empresa.codigo,
    slug: resultado.empresa.slug,
    nome: resultado.empresa.nome,
    adminId: resultado.admin.id,
  };
}
