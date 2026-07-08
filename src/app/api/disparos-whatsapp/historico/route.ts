import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { listarCampanhasWhatsapp } from "@/lib/whatsapp-disparos/campanha-servidor";

export async function GET(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "todos";
  const busca = url.searchParams.get("busca") || undefined;
  const formato = url.searchParams.get("formato") || "json";

  const campanhas = await listarCampanhasWhatsapp(ctx.empresaId, {
    status: status === "todos" ? undefined : status,
    busca,
    limite: 500,
  });

  if (formato === "xlsx") {
    const rows = campanhas.map((c) => ({
      Nome: c.nome,
      Status: c.status,
      Contatos: c.totalContatos,
      Enviadas: c.enviadas,
      Pendentes: c.pendentes,
      Falhas: c.falhas,
      Usuario: c.userName || "",
      Inicio: c.iniciadoEm || "",
      Fim: c.concluidoEm || "",
      Criada: c.createdAt,
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Historico");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="historico-disparos-whatsapp.xlsx"',
      },
    });
  }

  return NextResponse.json({ campanhas });
}
