import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { exigirGestorUsuarios } from "@/lib/exigir-gestor";
import {
  gerarSenhaAutomatica,
  mapUsuarioListagem,
  ROLES_USUARIO,
  serializarPermissoesUsuario,
  usuarioEhProprietario,
  type PermissoesUsuario,
} from "@/lib/usuarios-sistema";
import { normalizarPermissoesCompletas } from "@/lib/usuarios-menu-permissoes";

const permissaoCrudSchema = z.object({
  ver: z.boolean().optional(),
  criar: z.boolean().optional(),
  editar: z.boolean().optional(),
  excluir: z.boolean().optional(),
});

const permissoesSchema = z.object({
  setores: z.array(z.string()).optional(),
  modulos: z.record(permissaoCrudSchema).optional(),
  situacao: z.enum(["ativo", "inativo"]).optional(),
  permitirRetiradasCarteira: z.boolean().optional(),
  permitirAlterarChavePix: z.boolean().optional(),
  permitirAlterarSenha: z.boolean().optional(),
  acessoMobile: z.boolean().optional(),
  avatarDataUrl: z.string().optional(),
});

const criarSchema = z.object({
  name: z.string().min(2, "Informe o nome."),
  email: z.string().email("E-mail inválido."),
  password: z.string().min(6).optional().or(z.literal("")),
  role: z.enum(ROLES_USUARIO),
  colaboradorId: z.string().optional().nullable(),
  colaboradorNome: z.string().optional().nullable(),
  moduloProducao: z.boolean().optional(),
  permissoes: permissoesSchema.optional(),
});

export async function GET(request: Request) {
  const auth = await exigirGestorUsuarios();
  if ("erro" in auth && auth.erro) return auth.erro;

  const { searchParams } = new URL(request.url);
  const excluidos = searchParams.get("excluidos") === "1";

  const lista = await prisma.user.findMany({
    where: excluidos ? { excluidoEm: { not: null } } : { excluidoEm: null },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      colaboradorId: true,
      colaboradorNome: true,
      moduloProducao: true,
      permissoesJson: true,
      excluidoEm: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    usuarios: lista.map(mapUsuarioListagem),
  });
}

export async function POST(request: Request) {
  const auth = await exigirGestorUsuarios();
  if ("erro" in auth && auth.erro) return auth.erro;

  try {
    const body = await request.json();
    const data = criarSchema.parse(body);

    if (usuarioEhProprietario(data.role)) {
      const jaTem = await prisma.user.findFirst({
        where: {
          role: { in: ["proprietario", "admin"] },
          excluidoEm: null,
        },
      });
      if (jaTem) {
        return NextResponse.json(
          { error: "Já existe um usuário proprietário ativo." },
          { status: 400 }
        );
      }
    }

    const email = data.email.trim().toLowerCase();
    const existe = await prisma.user.findUnique({ where: { email } });
    if (existe) {
      return NextResponse.json({ error: "Este e-mail já está em uso." }, { status: 400 });
    }

    const senha =
      data.password && data.password.trim().length >= 6
        ? data.password.trim()
        : gerarSenhaAutomatica();

    const permissoes = serializarPermissoesUsuario(
      normalizarPermissoesCompletas(
        {
          setores: data.permissoes?.setores ?? [],
          modulos: data.permissoes?.modulos,
          situacao: data.permissoes?.situacao ?? "ativo",
          permitirRetiradasCarteira: data.permissoes?.permitirRetiradasCarteira,
          permitirAlterarChavePix: data.permissoes?.permitirAlterarChavePix,
          permitirAlterarSenha: data.permissoes?.permitirAlterarSenha,
          acessoMobile: data.permissoes?.acessoMobile,
          avatarDataUrl: data.permissoes?.avatarDataUrl,
        } as Partial<PermissoesUsuario>,
        data.role
      )
    );

    const criado = await prisma.user.create({
      data: {
        name: data.name.trim(),
        email,
        password: await hashPassword(senha),
        role: data.role,
        colaboradorId: data.colaboradorId?.trim() || null,
        colaboradorNome: data.colaboradorNome?.trim() || null,
        moduloProducao: Boolean(data.moduloProducao),
        permissoesJson: permissoes,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        colaboradorId: true,
        colaboradorNome: true,
        moduloProducao: true,
        permissoesJson: true,
        excluidoEm: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ usuario: mapUsuarioListagem(criado) }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }
    console.error("[usuarios POST]", err);
    return NextResponse.json({ error: "Erro ao criar usuário." }, { status: 500 });
  }
}
