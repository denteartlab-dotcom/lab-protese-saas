import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { exigirMasterAdmin, respostaNaoAutorizadoMaster } from "@/lib/exigir-master-admin";
import { excluirEmpresaCompleta } from "@/lib/exclusao-empresa";
import { ipDaRequisicao, registrarLogMaster } from "@/lib/master-audit";
import { obterEmpresaDetalheMaster } from "@/lib/master-empresa";
import { validarSlugEmpresa } from "@/lib/empresa-padrao";
import { limitesDoPlano, normalizarPlanoEmpresa } from "@/lib/master-planos";
import { calcularDataVencimentoAssinatura } from "@/lib/assinatura-empresa";
import { executarSemRls, runWithRlsBypass } from "@/lib/prisma-tenant";
import { z } from "zod";

const schemaAtualizar = z.object({
  nome: z.string().min(2).optional(),
  slug: z.string().optional(),
  responsavel: z.string().optional(),
  cnpj: z.string().optional(),
  telefone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  plano: z.enum(["basico", "profissional", "premium"]).optional(),
  limiteUsuarios: z.number().int().positive().optional(),
  limiteTrabalhos: z.number().int().positive().optional(),
  dataVencimento: z.string().nullable().optional(),
  observacoes: z.string().optional(),
  status: z.enum(["ativo", "inativo", "bloqueado", "pendente"]).optional(),
  adminNome: z.string().min(2).optional(),
  adminEmail: z.string().email().optional(),
  adminSenha: z.string().min(6).optional(),
  diasAssinatura: z.number().int().positive().optional(),
});

function parseDataVencimento(value?: string | null): Date | null | undefined {
  if (value === undefined) return undefined;
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d, 12);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await exigirMasterAdmin();
    const { id } = await params;
    const detalhe = await obterEmpresaDetalheMaster(id);
    if (!detalhe) {
      return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
    }
    return NextResponse.json(detalhe);
  } catch {
    return respostaNaoAutorizadoMaster();
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { master } = await exigirMasterAdmin();
    const { id } = await params;
    const body = schemaAtualizar.parse(await request.json());

    const existente = await executarSemRls((tx) =>
      tx.empresa.findUnique({ where: { id } })
    );
    if (!existente) {
      return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
    }

    const dadosEmpresa: Record<string, unknown> = {};
    if (body.nome !== undefined) dadosEmpresa.nome = body.nome.trim();
    if (body.responsavel !== undefined) dadosEmpresa.responsavel = body.responsavel.trim() || null;
    if (body.cnpj !== undefined) dadosEmpresa.cnpj = body.cnpj.trim() || null;
    if (body.telefone !== undefined) dadosEmpresa.telefone = body.telefone.trim() || null;
    if (body.whatsapp !== undefined) dadosEmpresa.whatsapp = body.whatsapp.trim() || null;
    if (body.email !== undefined) dadosEmpresa.email = body.email.trim().toLowerCase() || null;
    if (body.cidade !== undefined) dadosEmpresa.cidade = body.cidade.trim() || null;
    if (body.estado !== undefined) dadosEmpresa.estado = body.estado.trim() || null;
    if (body.observacoes !== undefined) dadosEmpresa.observacoes = body.observacoes.trim() || null;
    if (body.status !== undefined) dadosEmpresa.status = body.status;
    if (body.dataVencimento !== undefined) {
      dadosEmpresa.dataVencimento = parseDataVencimento(body.dataVencimento);
    }
    if (body.diasAssinatura !== undefined && body.status === "ativo") {
      dadosEmpresa.dataVencimento = calcularDataVencimentoAssinatura(body.diasAssinatura);
    }
    if (body.plano !== undefined) {
      const plano = normalizarPlanoEmpresa(body.plano);
      dadosEmpresa.plano = plano;
      if (body.limiteUsuarios === undefined) {
        dadosEmpresa.limiteUsuarios = limitesDoPlano(plano).usuarios;
      }
      if (body.limiteTrabalhos === undefined) {
        dadosEmpresa.limiteTrabalhos = limitesDoPlano(plano).trabalhos;
      }
    }
    if (body.limiteUsuarios !== undefined) dadosEmpresa.limiteUsuarios = body.limiteUsuarios;
    if (body.limiteTrabalhos !== undefined) dadosEmpresa.limiteTrabalhos = body.limiteTrabalhos;

    if (body.slug !== undefined) {
      const slug = validarSlugEmpresa(body.slug);
      if (!slug) {
        return NextResponse.json({ error: "Slug inválido." }, { status: 400 });
      }
      const slugEmUso = await executarSemRls((tx) =>
        tx.empresa.findFirst({
          where: { slug, NOT: { id } },
        })
      );
      if (slugEmUso) {
        return NextResponse.json({ error: "Slug já em uso." }, { status: 400 });
      }
      dadosEmpresa.slug = slug;
    }

    await executarSemRls(async (tx) => {
      if (Object.keys(dadosEmpresa).length > 0) {
        await tx.empresa.update({ where: { id }, data: dadosEmpresa });
      }

      if (body.adminNome || body.adminEmail || body.adminSenha) {
        const admin = await tx.user.findFirst({
          where: { empresaId: id, role: { in: ["proprietario", "admin"] }, excluidoEm: null },
          orderBy: { createdAt: "asc" },
        });
        if (admin) {
          const dadosAdmin: Record<string, string> = {};
          if (body.adminNome) dadosAdmin.name = body.adminNome.trim();
          if (body.adminEmail) dadosAdmin.email = body.adminEmail.trim().toLowerCase();
          if (body.adminSenha) dadosAdmin.password = await hashPassword(body.adminSenha);
          if (Object.keys(dadosAdmin).length > 0) {
            await tx.user.update({ where: { id: admin.id }, data: dadosAdmin });
          }
        }
      }
    });

    await registrarLogMaster(master.id, "EDITAR_EMPRESA", {
      empresaId: id,
      detalhes: `Empresa atualizada: ${existente.nome}`,
      ip: ipDaRequisicao(request),
    });

    const detalhe = await obterEmpresaDetalheMaster(id);
    return NextResponse.json(detalhe);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }
    console.error("[admin-master/empresas PATCH]", error);
    return NextResponse.json({ error: "Erro ao atualizar empresa." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { master } = await exigirMasterAdmin();
    const { id } = await params;

    const existente = await executarSemRls((tx) =>
      tx.empresa.findUnique({
        where: { id },
        select: { id: true, nome: true, slug: true, codigo: true },
      })
    );
    if (!existente) {
      return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
    }

    await runWithRlsBypass(() =>
      excluirEmpresaCompleta(existente, {
        motivo: "manual",
        masterId: master.id,
        ip: ipDaRequisicao(request),
        aguardarArquivos: false,
      })
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return respostaNaoAutorizadoMaster();
    }
    console.error("[admin-master/empresas DELETE]", error);
    return NextResponse.json({ error: "Erro ao excluir empresa." }, { status: 500 });
  }
}
