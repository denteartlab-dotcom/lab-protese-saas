import { NextResponse } from "next/server";
import { z } from "zod";
import { requireEmpresaContext } from "@/lib/empresa-context";
import {
  obterChatbotConfig,
  salvarChatbotConfig,
} from "@/lib/whatsapp-chat/chatbot-config-servidor";
import { montarTextoMenuChat } from "@/lib/whatsapp-chat/chatbot-config-types";
import { prisma } from "@/lib/db";

const schema = z.object({
  ativo: z.boolean(),
  intro: z.string().min(1).max(500),
  rodapeMenu: z.string().min(1).max(300),
  opcao1Ativa: z.boolean(),
  opcao1Texto: z.string().min(1).max(120),
  opcao2Ativa: z.boolean(),
  opcao2Texto: z.string().min(1).max(120),
  opcao3Ativa: z.boolean(),
  opcao3Texto: z.string().min(1).max(120),
  opcao4Ativa: z.boolean(),
  opcao4Texto: z.string().min(1).max(120),
  msgAtendente: z.string().min(1).max(800),
  msgAguardandoOs: z.string().min(1).max(300),
  msgNaoEntendi: z.string().min(1).max(300),
});

export async function GET() {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const config = await obterChatbotConfig(ctx.empresaId);
  const empresa = await prisma.empresa.findUnique({
    where: { id: ctx.empresaId },
    select: { nome: true },
  });
  const previewMenu = montarTextoMenuChat(config, empresa?.nome || "Laboratório");

  return NextResponse.json({ config, previewMenu, nomeLab: empresa?.nome || "Laboratório" });
}

export async function PUT(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const data = schema.parse(body);
    const config = await salvarChatbotConfig(ctx.empresaId, data);
    const empresa = await prisma.empresa.findUnique({
      where: { id: ctx.empresaId },
      select: { nome: true },
    });
    const previewMenu = montarTextoMenuChat(config, empresa?.nome || "Laboratório");
    return NextResponse.json({ ok: true, config, previewMenu });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao salvar" },
      { status: 500 }
    );
  }
}
