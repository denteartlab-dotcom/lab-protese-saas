import { NextResponse } from "next/server";
import { exigirMasterAdmin, respostaNaoAutorizadoMaster } from "@/lib/exigir-master-admin";
import { ipDaRequisicao, registrarLogMaster } from "@/lib/master-audit";
import { calcularDataVencimentoAssinatura } from "@/lib/assinatura-empresa";
import { executarSemRls } from "@/lib/prisma-tenant";
import { z } from "zod";

const schema = z.object({
  dias: z.number().int().min(1).max(3650),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { master } = await exigirMasterAdmin();
    const { id } = await params;
    const body = schema.parse(await request.json());

    const empresa = await executarSemRls((tx) =>
      tx.empresa.findUnique({
        where: { id },
        select: {
          id: true,
          nome: true,
          status: true,
          dataVencimento: true,
          observacoes: true,
        },
      })
    );
    if (!empresa) {
      return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
    }

    const dataVencimento = calcularDataVencimentoAssinatura(body.dias);
    const { limparMarcaTesteGratisObservacoes } = await import(
      "@/lib/uploads-limites-plano"
    );

    const atualizada = await executarSemRls((tx) =>
      tx.empresa.update({
        where: { id },
        data: {
          status: "ativo",
          dataVencimento,
          observacoes: limparMarcaTesteGratisObservacoes(empresa.observacoes),
        },
        select: {
          id: true,
          nome: true,
          status: true,
          dataVencimento: true,
        },
      })
    );

    await registrarLogMaster(master.id, "ATIVAR_ASSINATURA", {
      empresaId: id,
      detalhes: `Assinatura ativada por ${body.dias} dias até ${dataVencimento.toLocaleDateString("pt-BR")}`,
      ip: ipDaRequisicao(request),
    });

    return NextResponse.json({
      ok: true,
      empresa: {
        id: atualizada.id,
        nome: atualizada.nome,
        status: atualizada.status,
        dataVencimento: atualizada.dataVencimento?.toISOString() ?? null,
        dias: body.dias,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Informe dias válidos (1 a 3650)." }, { status: 400 });
    }
    console.error("[admin-master/ativar-assinatura]", error);
    return respostaNaoAutorizadoMaster();
  }
}
