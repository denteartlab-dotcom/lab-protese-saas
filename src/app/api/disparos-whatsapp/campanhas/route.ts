import { NextResponse } from "next/server";
import { z } from "zod";
import { requireEmpresaContext } from "@/lib/empresa-context";
import {
  criarCampanhaWhatsapp,
  listarCampanhasWhatsapp,
} from "@/lib/whatsapp-disparos/campanha-servidor";
import type { ContatoImportado } from "@/lib/whatsapp-disparos/telefone-br";

const contatoSchema = z.object({
  nome: z.string(),
  telefone: z.string(),
  telefoneNormalizado: z.string(),
  cidade: z.string().optional(),
  empresaNome: z.string().optional(),
  dentista: z.string().optional(),
  consulta: z.string().optional(),
  valor: z.string().optional(),
  vencimento: z.string().optional(),
  valido: z.boolean(),
});

const schema = z.object({
  nome: z.string().min(1).max(120),
  mensagem: z.string().min(1).max(4000),
  origemContatos: z.enum(["pacientes", "clientes", "excel", "csv"]),
  intervaloSegundos: z.number().int().min(5).max(30),
  atrasoAleatorio: z.boolean(),
  limitePorHora: z.number().int().positive().nullable(),
  agendadoPara: z.string().datetime().nullable().optional(),
  status: z.enum(["rascunho", "agendada"]).optional(),
  anexoTipo: z.string().nullable().optional(),
  anexoNome: z.string().nullable().optional(),
  anexoMime: z.string().nullable().optional(),
  anexoUploadId: z.string().nullable().optional(),
  contatos: z.array(contatoSchema).optional(),
});

export async function GET(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || undefined;
  const busca = url.searchParams.get("busca") || undefined;
  const campanhas = await listarCampanhasWhatsapp(ctx.empresaId, { status, busca });
  return NextResponse.json({ campanhas });
}

export async function POST(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const data = schema.parse(body);
    const contatos = (data.contatos || []).filter((c) => c.valido) as ContatoImportado[];

    const campanha = await criarCampanhaWhatsapp(ctx.empresaId, {
      ...data,
      limitePorHora: data.limitePorHora,
      agendadoPara: data.agendadoPara ? new Date(data.agendadoPara) : null,
      status: data.status || "rascunho",
      userId: ctx.user.id,
      userName: ctx.user.name,
      contatos,
    });

    return NextResponse.json({ ok: true, campanha });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao criar campanha" },
      { status: 500 }
    );
  }
}
