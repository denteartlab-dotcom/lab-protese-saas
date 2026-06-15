import { NextResponse } from "next/server";
import { z } from "zod";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { gerarTokenAcompanhamentoCliente } from "@/lib/cliente-acompanhamento";
import { prisma } from "@/lib/db";
import { schemaNomeCliente } from "@/lib/cliente-validacao";

const clienteImportSchema = z.object({
  nome: schemaNomeCliente,
  razaoSocial: z.string().optional(),
  cnpjCpf: z.string().optional(),
  cro: z.string().optional(),
  telefone: z.string().optional(),
  celular: z.string().optional(),
  email: z.string().optional(),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
  cep: z.string().optional(),
  observacoes: z.string().optional(),
});

const schema = z.object({
  clientes: z.array(clienteImportSchema).min(1).max(500),
});

export async function POST(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const data = schema.parse(body);

    let importados = 0;
    let ignorados = 0;

    for (const cliente of data.clientes) {
      const parsedNome = schemaNomeCliente.safeParse(cliente.nome);
      if (!parsedNome.success) {
        ignorados += 1;
        continue;
      }
      const nome = parsedNome.data;

      await prisma.cliente.create({
        data: {
          empresaId: ctx.empresaId,
          nome,
          razaoSocial: cliente.razaoSocial?.trim() || null,
          cnpjCpf: cliente.cnpjCpf?.trim() || null,
          cro: cliente.cro?.trim() || null,
          telefone: cliente.telefone?.trim() || null,
          celular: cliente.celular?.trim() || null,
          email: cliente.email?.trim() || null,
          endereco: cliente.endereco?.trim() || null,
          cidade: cliente.cidade?.trim() || null,
          uf: cliente.uf?.trim() || null,
          cep: cliente.cep?.trim() || null,
          observacoes: cliente.observacoes?.trim() || null,
          tokenAcompanhamento: gerarTokenAcompanhamentoCliente(),
        },
      });
      importados += 1;
    }

    return NextResponse.json({ importados, ignorados });
  } catch {
    return NextResponse.json({ error: "Arquivo ou dados inválidos." }, { status: 400 });
  }
}
