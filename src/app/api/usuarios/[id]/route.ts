import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { exigirGestorUsuarios } from "@/lib/exigir-gestor";
import {
  mapUsuarioListagem,
  parsePermissoesUsuario,
  ROLES_USUARIO,
  serializarPermissoesUsuario,
  usuarioEhProprietario,
} from "@/lib/usuarios-sistema";

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

const atualizarSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional().or(z.literal("")),
  role: z.enum(ROLES_USUARIO).optional(),
  colaboradorId: z.string().optional().nullable(),
  colaboradorNome: z.string().optional().nullable(),
  moduloProducao: z.boolean().optional(),
  permissoes: permissoesSchema.optional(),
  restaurar: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

const selectUsuario = {
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
} as const;

export async function GET(_request: Request, { params }: Params) {
  const auth = await exigirGestorUsuarios();
  if ("erro" in auth && auth.erro) return auth.erro;

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: selectUsuario,
  });

  if (!user) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ usuario: mapUsuarioListagem(user) });
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await exigirGestorUsuarios();
  if ("erro" in auth && auth.erro) return auth.erro;

  const { id } = await params;

  try {
    const body = await request.json();
    const data = atualizarSchema.parse(body);

    const atual = await prisma.user.findUnique({ where: { id } });
    if (!atual) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    if (data.restaurar) {
      const atualizado = await prisma.user.update({
        where: { id },
        data: { excluidoEm: null },
        select: selectUsuario,
      });
      return NextResponse.json({ usuario: mapUsuarioListagem(atualizado) });
    }

    if (atual.excluidoEm) {
      return NextResponse.json({ error: "Usuário excluído." }, { status: 400 });
    }

    const novoRole = data.role ?? atual.role;
    if (
      usuarioEhProprietario(novoRole) &&
      !usuarioEhProprietario(atual.role)
    ) {
      const jaTem = await prisma.user.findFirst({
        where: {
          id: { not: id },
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

    if (
      usuarioEhProprietario(atual.role) &&
      auth.session!.id === id &&
      data.role &&
      !usuarioEhProprietario(data.role)
    ) {
      return NextResponse.json(
        { error: "Você não pode remover seu próprio perfil de proprietário." },
        { status: 400 }
      );
    }

    const email = data.email?.trim().toLowerCase();
    if (email && email !== atual.email) {
      const existe = await prisma.user.findUnique({ where: { email } });
      if (existe && existe.id !== id) {
        return NextResponse.json({ error: "Este e-mail já está em uso." }, { status: 400 });
      }
    }

    const permissoesJson =
      data.permissoes !== undefined
        ? serializarPermissoesUsuario({
            ...parsePermissoesUsuario(atual.permissoesJson),
            ...data.permissoes,
            setores: data.permissoes.setores ?? parsePermissoesUsuario(atual.permissoesJson).setores,
          })
        : undefined;

    const atualizado = await prisma.user.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(email ? { email } : {}),
        ...(data.password
          ? { password: await hashPassword(data.password) }
          : {}),
        ...(data.role !== undefined ? { role: data.role } : {}),
        ...(data.colaboradorId !== undefined
          ? { colaboradorId: data.colaboradorId?.trim() || null }
          : {}),
        ...(data.colaboradorNome !== undefined
          ? { colaboradorNome: data.colaboradorNome?.trim() || null }
          : {}),
        ...(data.moduloProducao !== undefined
          ? { moduloProducao: data.moduloProducao }
          : {}),
        ...(permissoesJson !== undefined ? { permissoesJson } : {}),
      },
      select: selectUsuario,
    });

    return NextResponse.json({ usuario: mapUsuarioListagem(atualizado) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }
    console.error("[usuarios PATCH]", err);
    return NextResponse.json({ error: "Erro ao atualizar usuário." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await exigirGestorUsuarios();
  if ("erro" in auth && auth.erro) return auth.erro;

  const { id } = await params;

  if (auth.session!.id === id) {
    return NextResponse.json(
      { error: "Você não pode excluir seu próprio usuário." },
      { status: 400 }
    );
  }

  const atual = await prisma.user.findUnique({ where: { id } });
  if (!atual) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  if (usuarioEhProprietario(atual.role)) {
    const outros = await prisma.user.count({
      where: {
        excluidoEm: null,
        role: { in: ["proprietario", "admin"] },
        id: { not: id },
      },
    });
    if (outros === 0) {
      return NextResponse.json(
        { error: "Não é possível excluir o único proprietário." },
        { status: 400 }
      );
    }
  }

  await prisma.user.update({
    where: { id },
    data: { excluidoEm: new Date() },
  });

  return NextResponse.json({ ok: true });
}
