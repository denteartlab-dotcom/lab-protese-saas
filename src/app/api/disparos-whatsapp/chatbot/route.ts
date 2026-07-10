import { NextResponse } from "next/server";
import { z } from "zod";
import { requireEmpresaContext } from "@/lib/empresa-context";
import {
  obterChatbotConfig,
  salvarChatbotConfig,
} from "@/lib/whatsapp-chat/chatbot-config-servidor";
import { montarTextoMenuChat } from "@/lib/whatsapp-chat/chatbot-config-types";
import { prisma } from "@/lib/db";

const anexoSchema = z
  .object({
    uploadId: z.string().nullable(),
    nome: z.string(),
    mimeType: z.string(),
    tipo: z.enum(["imagem", "pdf", "documento"]),
    url: z.string().optional(),
  })
  .nullable()
  .optional();

const opcaoSchema = z.object({
  id: z.string().min(1).max(80),
  ativa: z.boolean(),
  texto: z.string().min(1).max(120),
  tipo: z.enum(["sistema", "mensagem", "sim_nao"]),
  acao: z.enum(["listar_os", "consultar_os", "link_acompanhamento", "atendente"]).optional(),
  mensagem: z.string().max(2000).optional(),
  pergunta: z.string().max(500).optional(),
  respostaSimTexto: z.string().max(2000).optional(),
  respostaNaoTexto: z.string().max(2000).optional(),
  respostaSimAnexo: anexoSchema,
  respostaNaoAnexo: anexoSchema,
});

const schema = z.object({
  ativo: z.boolean(),
  responderSemCadastro: z.boolean(),
  intro: z.string().min(1).max(500),
  rodapeMenu: z.string().min(1).max(300),
  opcoes: z.array(opcaoSchema).min(1).max(12),
  msgAtendente: z.string().min(1).max(800),
  msgAguardandoOs: z.string().min(1).max(300),
  msgNaoEntendi: z.string().min(1).max(300),
  msgSemCadastro: z.string().min(1).max(800),
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
    return NextResponse.json({ ok: true, config, previewMenu, nomeLab: empresa?.nome || "Laboratório" });
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
