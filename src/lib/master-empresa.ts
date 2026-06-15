import { hashPassword } from "@/lib/auth";
import { gravarDadosPadraoEmpresa, validarSlugEmpresa } from "@/lib/empresa-padrao";
import { prisma } from "@/lib/db";
import { limitesDoPlano, normalizarPlanoEmpresa } from "@/lib/master-planos";
import { CONFIG_LAB_STORAGE_KEY } from "@/lib/configuracoes-lab";
import { chaveJsonStoreTenant } from "@/lib/json-store-tenant";
import { normalizarSlugEmpresa } from "@/lib/rotas-app";
import { garantirPastasUploadEmpresa } from "@/lib/uploads-armazenamento-server";
import { statusCobrancaAssinaturaPago } from "@/lib/assinatura-pix-provedor";

export type DadosCriarEmpresaMaster = {
  nome: string;
  slug?: string;
  responsavel?: string;
  cnpj?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  cidade?: string;
  estado?: string;
  plano?: string;
  limiteUsuarios?: number;
  limiteTrabalhos?: number;
  dataVencimento?: string | null;
  observacoes?: string;
  status?: string;
  adminNome: string;
  adminEmail: string;
  adminSenha: string;
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

function parseDataVencimento(value?: string | null): Date | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d, 12);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function criarEmpresaMaster(dados: DadosCriarEmpresaMaster) {
  const nome = dados.nome.trim();
  if (nome.length < 2) throw new Error("NOME_INVALIDO");

  const adminNome = dados.adminNome.trim();
  const adminEmail = dados.adminEmail.trim().toLowerCase();
  const adminSenha = dados.adminSenha;

  if (adminNome.length < 2) throw new Error("ADMIN_NOME_INVALIDO");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) throw new Error("EMAIL_INVALIDO");
  if (adminSenha.length < 6) throw new Error("SENHA_INVALIDA");

  let slug = dados.slug?.trim() ? validarSlugEmpresa(dados.slug) : gerarSlugDeNome(nome);
  if (!slug) throw new Error("SLUG_INVALIDO");

  const slugBase = slug;
  let tentativa = 0;
  while (await prisma.empresa.findUnique({ where: { slug } })) {
    tentativa += 1;
    slug = `${slugBase}-${tentativa}`;
    if (tentativa > 50) throw new Error("SLUG_EM_USO");
  }

  const plano = normalizarPlanoEmpresa(dados.plano ?? "basico");
  const limites = limitesDoPlano(plano);
  const limiteUsuarios = dados.limiteUsuarios ?? limites.usuarios;
  const limiteTrabalhos = dados.limiteTrabalhos ?? limites.trabalhos;
  const status = dados.status?.trim() || "ativo";
  const codigo = await gerarCodigoEmpresa();
  const password = await hashPassword(adminSenha);

  const resultado = await prisma.$transaction(async (tx) => {
    const empresa = await tx.empresa.create({
      data: {
        codigo,
        nome,
        slug,
        responsavel: dados.responsavel?.trim() || null,
        cnpj: dados.cnpj?.trim() || null,
        telefone: dados.telefone?.trim() || null,
        whatsapp: dados.whatsapp?.trim() || null,
        email: dados.email?.trim().toLowerCase() || null,
        cidade: dados.cidade?.trim() || null,
        estado: dados.estado?.trim() || null,
        plano,
        limiteUsuarios,
        limiteTrabalhos,
        dataVencimento: parseDataVencimento(dados.dataVencimento),
        observacoes: dados.observacoes?.trim() || null,
        status,
      },
    });

    const admin = await tx.user.create({
      data: {
        empresaId: empresa.id,
        name: adminNome,
        email: adminEmail,
        password,
        role: "proprietario",
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
  await garantirPastasUploadEmpresa(resultado.empresa.slug);

  return resultado;
}

export async function obterDashboardMaster() {
  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const inicioAno = new Date(agora.getFullYear(), 0, 1);
  const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59);

  const [
    totalEmpresas,
    empresasAtivas,
    empresasBloqueadas,
    empresasInadimplentes,
    totalUsuarios,
    totalTrabalhos,
    faturamentoTotal,
    receitaMensal,
    receitaAnual,
  ] = await Promise.all([
    prisma.empresa.count(),
    prisma.empresa.count({ where: { status: "ativo" } }),
    prisma.empresa.count({ where: { status: "bloqueado" } }),
    prisma.empresa.count({
      where: {
        status: "ativo",
        dataVencimento: { lt: agora },
      },
    }),
    prisma.user.count({ where: { excluidoEm: null } }),
    prisma.trabalho.count(),
    prisma.lancamento.aggregate({
      where: { tipo: "receita", status: "pago" },
      _sum: { valor: true },
    }),
    prisma.lancamento.aggregate({
      where: {
        tipo: "receita",
        status: "pago",
        data: { gte: inicioMes, lte: fimMes },
      },
      _sum: { valor: true },
    }),
    prisma.lancamento.aggregate({
      where: {
        tipo: "receita",
        status: "pago",
        data: { gte: inicioAno },
      },
      _sum: { valor: true },
    }),
  ]);

  return {
    totalEmpresas,
    empresasAtivas,
    empresasBloqueadas,
    empresasInadimplentes,
    totalUsuarios,
    totalTrabalhos,
    faturamentoTotal: faturamentoTotal._sum.valor ?? 0,
    receitaMensal: receitaMensal._sum.valor ?? 0,
    receitaAnual: receitaAnual._sum.valor ?? 0,
  };
}

export async function listarEmpresasMaster() {
  const empresas = await prisma.empresa.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          users: { where: { excluidoEm: null } },
          trabalhos: true,
        },
      },
    },
  });

  return empresas.map((e) => ({
    id: e.id,
    codigo: e.codigo,
    nome: e.nome,
    slug: e.slug,
    responsavel: e.responsavel,
    cnpj: e.cnpj,
    telefone: e.telefone,
    whatsapp: e.whatsapp,
    email: e.email,
    cidade: e.cidade,
    estado: e.estado,
    plano: e.plano,
    limiteUsuarios: e.limiteUsuarios,
    limiteTrabalhos: e.limiteTrabalhos,
    dataVencimento: e.dataVencimento?.toISOString() ?? null,
    observacoes: e.observacoes,
    status: e.status,
    createdAt: e.createdAt.toISOString(),
    totalUsuarios: e._count.users,
    totalTrabalhos: e._count.trabalhos,
    urlAcesso: `/app/${e.slug}`,
  }));
}

export async function obterEmpresaDetalheMaster(empresaId: string) {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    include: {
      users: {
        where: { excluidoEm: null },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
        orderBy: { name: "asc" },
      },
      _count: {
        select: {
          clientes: true,
          trabalhos: true,
          lancamentos: true,
        },
      },
    },
  });

  if (!empresa) return null;

  const [receitas, despesas, configLab] = await Promise.all([
    prisma.lancamento.aggregate({
      where: { empresaId, tipo: "receita", status: "pago" },
      _sum: { valor: true },
    }),
    prisma.lancamento.aggregate({
      where: { empresaId, tipo: "despesa", status: "pago" },
      _sum: { valor: true },
    }),
    prisma.jsonStore.findUnique({
      where: { key: chaveJsonStoreTenant(empresaId, CONFIG_LAB_STORAGE_KEY) },
      select: { payload: true },
    }),
  ]);

  let configuracoes: Record<string, unknown> | null = null;
  if (configLab?.payload) {
    try {
      configuracoes = JSON.parse(configLab.payload) as Record<string, unknown>;
    } catch {
      configuracoes = null;
    }
  }

  const clientes = await prisma.cliente.findMany({
    where: { empresaId },
    select: { id: true, nome: true, email: true, telefone: true, ativo: true },
    take: 50,
    orderBy: { nome: "asc" },
  });

  const trabalhosRecentes = await prisma.trabalho.findMany({
    where: { empresaId },
    select: {
      id: true,
      numeroOs: true,
      tipoProtese: true,
      status: true,
      valor: true,
      dataEntrada: true,
      cliente: { select: { nome: true } },
    },
    take: 30,
    orderBy: { dataEntrada: "desc" },
  });

  const lancamentosRecentes = await prisma.lancamento.findMany({
    where: { empresaId },
    select: {
      id: true,
      tipo: true,
      descricao: true,
      valor: true,
      status: true,
      data: true,
    },
    take: 30,
    orderBy: { data: "desc" },
  });

  return {
    empresa: {
      id: empresa.id,
      codigo: empresa.codigo,
      nome: empresa.nome,
      slug: empresa.slug,
      responsavel: empresa.responsavel,
      cnpj: empresa.cnpj,
      telefone: empresa.telefone,
      whatsapp: empresa.whatsapp,
      email: empresa.email,
      cidade: empresa.cidade,
      estado: empresa.estado,
      plano: empresa.plano,
      limiteUsuarios: empresa.limiteUsuarios,
      limiteTrabalhos: empresa.limiteTrabalhos,
      dataVencimento: empresa.dataVencimento?.toISOString() ?? null,
      observacoes: empresa.observacoes,
      status: empresa.status,
      createdAt: empresa.createdAt.toISOString(),
      urlAcesso: `/app/${empresa.slug}`,
    },
    usuarios: empresa.users,
    clientes,
    trabalhos: trabalhosRecentes,
    financeiro: {
      totalReceitas: receitas._sum.valor ?? 0,
      totalDespesas: despesas._sum.valor ?? 0,
      lancamentosRecentes,
    },
    totais: {
      clientes: empresa._count.clientes,
      trabalhos: empresa._count.trabalhos,
      lancamentos: empresa._count.lancamentos,
      usuarios: empresa.users.length,
    },
    configuracoes,
  };
}

export async function listarCobrancasAssinaturaMaster() {
  const cobrancas = await prisma.cobrancaAssinatura.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      empresa: {
        select: {
          id: true,
          nome: true,
          slug: true,
          codigo: true,
        },
      },
    },
  });

  return cobrancas.map((c) => {
    const pago = statusCobrancaAssinaturaPago(c.provedor, c.statusAsaas) || Boolean(c.pagoEm);
    return {
      id: c.id,
      empresaId: c.empresaId,
      empresaNome: c.empresa.nome,
      empresaSlug: c.empresa.slug,
      empresaCodigo: c.empresa.codigo,
      provedor: c.provedor,
      asaasPaymentId: c.asaasPaymentId,
      plano: c.plano,
      valor: c.valor,
      diasRenovacao: c.diasRenovacao,
      statusAsaas: c.statusAsaas,
      pago,
      pagoEm: c.pagoEm?.toISOString() ?? null,
      renovadoEm: c.renovadoEm?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    };
  });
}
