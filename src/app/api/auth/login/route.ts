import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import {
  empresaBloqueadaAguardandoAtivacao,
  empresaPrecisaPaginaRenovacao,
  empresaTemAcessoAssinatura,
  mensagemBloqueioAssinatura,
} from "@/lib/assinatura-empresa";
import { parsePermissoesUsuario } from "@/lib/usuarios-sistema";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  remember: z.boolean().optional(),
  empresaSlug: z.string().min(1).optional(),
});

const selectUsuarioLogin = {
  id: true,
  name: true,
  email: true,
  password: true,
  role: true,
  permissoesJson: true,
  excluidoEm: true,
  empresaId: true,
  empresa: {
    select: {
      id: true,
      nome: true,
      slug: true,
      status: true,
      dataVencimento: true,
    },
  },
} as const;

export async function POST(request: Request) {
  if (!process.env.JWT_SECRET?.trim()) {
    return NextResponse.json(
      {
        error:
          "Servidor sem JWT_SECRET. Em Vercel: Settings → Environment Variables → JWT_SECRET → Redeploy.",
      },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 400 });
  }

  const { email, password, remember, empresaSlug } = parsed.data;
  const emailNorm = email.trim().toLowerCase();
  const slugInformado = empresaSlug?.trim().toLowerCase();

  try {
    const candidatos = await prisma.user.findMany({
      where: {
        email: emailNorm,
        excluidoEm: null,
        ...(slugInformado ? { empresa: { slug: slugInformado } } : {}),
      },
      select: selectUsuarioLogin,
      orderBy: { createdAt: "asc" },
    });

    if (candidatos.length === 0) {
      return NextResponse.json(
        { error: "E-mail ou senha inválidos." },
        { status: 401 }
      );
    }

    const comSenhaValida: typeof candidatos = [];
    for (const candidato of candidatos) {
      if (await verifyPassword(password, candidato.password)) {
        comSenhaValida.push(candidato);
      }
    }

    if (comSenhaValida.length === 0) {
      return NextResponse.json(
        { error: "E-mail ou senha inválidos." },
        { status: 401 }
      );
    }

    if (!slugInformado && comSenhaValida.length > 1) {
      return NextResponse.json(
        {
          error: "Este e-mail está em mais de um laboratório. Escolha qual deseja acessar.",
          code: "MULTIPLAS_CONTAS",
          empresas: comSenhaValida.map((item) => ({
            slug: item.empresa.slug,
            nome: item.empresa.nome,
          })),
        },
        { status: 409 }
      );
    }

    const user = comSenhaValida[0];
    if (!user.empresa) {
      return NextResponse.json(
        { error: "Laboratório indisponível. Contate o suporte." },
        { status: 403 }
      );
    }

    if (parsePermissoesUsuario(user.permissoesJson).situacao === "inativo") {
      return NextResponse.json(
        { error: "E-mail ou senha inválidos." },
        { status: 401 }
      );
    }

    if (empresaBloqueadaAguardandoAtivacao(user.empresa)) {
      return NextResponse.json(
        {
          error: mensagemBloqueioAssinatura(user.empresa),
          code: "ASSINATURA_INATIVA",
        },
        { status: 403 }
      );
    }

    const precisaRenovacao = empresaPrecisaPaginaRenovacao(user.empresa);
    const temAcesso = empresaTemAcessoAssinatura(user.empresa);

    if (!precisaRenovacao && !temAcesso) {
      return NextResponse.json(
        {
          error: mensagemBloqueioAssinatura(user.empresa),
          code: "ASSINATURA_INATIVA",
        },
        { status: 403 }
      );
    }

    await createSession(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        empresaId: user.empresaId,
        empresaSlug: user.empresa.slug,
        empresaNome: user.empresa.nome,
      },
      { remember: remember === true }
    );

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        empresaSlug: user.empresa.slug,
        empresaNome: user.empresa.nome,
      },
      ...(precisaRenovacao
        ? { code: "ASSINATURA_VENCIDA", redirect: "/assinatura-vencida" }
        : {}),
    });
  } catch (err) {
    console.error("[auth/login]", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (/Environment variable not found|DATABASE_URL|Can't reach database/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            "Banco não conectou. Na Vercel (Production e Preview): DATABASE_URL do Neon. Depois rode npm run db:publicar-neon no PC.",
        },
        { status: 503 }
      );
    }
    if (/column|does not exist|P2022|P2010/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            "Banco desatualizado. No PC: npm run db:publicar-neon (com .env do Neon) e tente de novo.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      {
        error:
          "Erro no servidor (banco ou sessão). Verifique DATABASE_URL e JWT_SECRET na Vercel (Production e Preview).",
      },
      { status: 500 }
    );
  }
}
