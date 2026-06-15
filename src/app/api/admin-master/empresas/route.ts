import { NextResponse } from "next/server";
import { exigirMasterAdmin, respostaNaoAutorizadoMaster } from "@/lib/exigir-master-admin";
import { ipDaRequisicao, registrarLogMaster } from "@/lib/master-audit";
import { criarEmpresaMaster, listarEmpresasMaster } from "@/lib/master-empresa";
import { z } from "zod";

const schemaCriar = z.object({
  nome: z.string().min(2),
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
  adminNome: z.string().min(2),
  adminEmail: z.string().email(),
  adminSenha: z.string().min(6),
  diasAssinatura: z.number().int().positive().optional(),
});

export async function GET() {
  try {
    await exigirMasterAdmin();
    const empresas = await listarEmpresasMaster();
    return NextResponse.json({ empresas });
  } catch {
    return respostaNaoAutorizadoMaster();
  }
}

export async function POST(request: Request) {
  try {
    const { master } = await exigirMasterAdmin();
    const body = schemaCriar.parse(await request.json());

    const resultado = await criarEmpresaMaster({
      ...body,
      email: body.email || undefined,
    });

    await registrarLogMaster(master.id, "CRIAR_EMPRESA", {
      empresaId: resultado.empresa.id,
      detalhes: `Empresa criada: ${resultado.empresa.nome} (${resultado.empresa.codigo})`,
      ip: ipDaRequisicao(request),
    });

    return NextResponse.json({
      empresa: {
        id: resultado.empresa.id,
        codigo: resultado.empresa.codigo,
        nome: resultado.empresa.nome,
        slug: resultado.empresa.slug,
        urlAcesso: `/app/${resultado.empresa.slug}`,
      },
      adminId: resultado.admin.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }
    const codigo = error instanceof Error ? error.message : "ERRO";
    const mapa: Record<string, string> = {
      NOME_INVALIDO: "Nome da empresa inválido.",
      ADMIN_NOME_INVALIDO: "Nome do administrador inválido.",
      EMAIL_INVALIDO: "E-mail do administrador inválido.",
      SENHA_INVALIDA: "Senha deve ter no mínimo 6 caracteres.",
      SLUG_INVALIDO: "Slug inválido.",
      SLUG_EM_USO: "Slug já em uso.",
    };
    if (mapa[codigo]) {
      return NextResponse.json({ error: mapa[codigo] }, { status: 400 });
    }
    console.error("[admin-master/empresas POST]", error);
    return NextResponse.json({ error: "Erro ao criar empresa." }, { status: 500 });
  }
}
