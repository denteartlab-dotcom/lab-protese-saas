import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { parsePermissoesUsuario } from "@/lib/usuarios-sistema";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  remember: z.boolean().optional(),
});

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

  const { email, password, remember } = parsed.data;

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        role: true,
        permissoesJson: true,
        excluidoEm: true,
      },
    });
    if (!user || user.excluidoEm) {
      return NextResponse.json(
        { error: "E-mail ou senha inválidos." },
        { status: 401 }
      );
    }
    if (parsePermissoesUsuario(user.permissoesJson).situacao === "inativo") {
      return NextResponse.json(
        { error: "E-mail ou senha inválidos." },
        { status: 401 }
      );
    }
    if (!(await verifyPassword(password, user.password))) {
      return NextResponse.json(
        { error: "E-mail ou senha inválidos." },
        { status: 401 }
      );
    }

    await createSession(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      { remember: remember === true }
    );

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
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
