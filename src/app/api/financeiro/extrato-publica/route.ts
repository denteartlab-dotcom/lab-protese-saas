import { NextResponse } from "next/server";
import { z } from "zod";
import { requireEmpresaContext } from "@/lib/empresa-context";
import {
  chaveExtratoPublica,
  criarTokenExtratoPublica,
  extratoPublicaPdfUrl,
  extratoPublicaUrl,
  montarRegistroExtratoPublica,
} from "@/lib/extrato-publica";
import { nomeArquivoExtratoCliente } from "@/lib/extrato-arquivo-nome";
import { salvarJsonStoreTenant } from "@/lib/json-store-tenant";

export const runtime = "nodejs";

const bodySchema = z.object({
  base64: z.string().min(1),
  nomeArquivo: z.string().min(1).max(180),
  titulo: z.string().min(1).max(240),
  clienteNome: z.string().min(1).max(240),
});

function limparNomeArquivo(nome: string, clienteNome?: string) {
  const bruto = nome.trim() || nomeArquivoExtratoCliente(clienteNome);
  return bruto
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

async function lerPayload(request: Request): Promise<{
  base64: string;
  nomeArquivo: string;
  titulo: string;
  clienteNome: string;
} | null> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    const clienteNome = String(form.get("clienteNome") || "").trim();
    const titulo = String(form.get("titulo") || "").trim();
    const nomeArquivoRaw = String(form.get("nomeArquivo") || "").trim();

    if (!(file instanceof File) || file.size < 1) return null;
    if (!clienteNome || !titulo) return null;

    const buffer = Buffer.from(await file.arrayBuffer());
    return {
      base64: buffer.toString("base64"),
      nomeArquivo: limparNomeArquivo(
        nomeArquivoRaw || file.name || nomeArquivoExtratoCliente(clienteNome),
        clienteNome
      ),
      titulo: titulo.slice(0, 240),
      clienteNome: clienteNome.slice(0, 240),
    };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return null;
  return {
    ...parsed.data,
    nomeArquivo: limparNomeArquivo(parsed.data.nomeArquivo, parsed.data.clienteNome),
  };
}

export async function POST(request: Request) {
  try {
    const ctx = await requireEmpresaContext();
    const data = await lerPayload(request);
    if (!data) {
      return NextResponse.json({ error: "Dados inválidos do extrato." }, { status: 400 });
    }

    const token = criarTokenExtratoPublica();
    const registro = montarRegistroExtratoPublica(data);

    await salvarJsonStoreTenant(
      ctx.empresaId,
      chaveExtratoPublica(token),
      registro
    );

    return NextResponse.json({
      token,
      url: extratoPublicaUrl(token),
      pdfUrl: extratoPublicaPdfUrl(token, data.nomeArquivo, data.clienteNome),
      nomeArquivo: data.nomeArquivo,
    });
  } catch (err) {
    const mensagem =
      err instanceof Error ? err.message : "Erro ao publicar extrato.";
    if (/não autorizado|nao autorizado|sessão|sessao/i.test(mensagem)) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    console.error("[extrato-publica POST]", err);
    return NextResponse.json({ error: mensagem }, { status: 500 });
  }
}
