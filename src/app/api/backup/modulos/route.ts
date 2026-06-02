import { NextResponse } from "next/server";
import { exigirGestorUsuarios } from "@/lib/exigir-gestor";
import { prisma } from "@/lib/db";
import {
  MODULOS_LIMPEZA,
  contarRegistrosModulos,
  type ModuloLimpezaId,
} from "@/lib/limpar-modulos-laboratorio";

export async function GET() {
  const auth = await exigirGestorUsuarios();
  if (auth.erro) return auth.erro;

  try {
    const contagens = await contarRegistrosModulos(prisma);
    const modulos = MODULOS_LIMPEZA.map((mod) => {
      const registros = contagens[mod.id as ModuloLimpezaId] ?? 0;
      const somenteNavegador =
        mod.id === "cadastros" || mod.id === "inicio" || mod.id === "configuracoes";
      return {
        id: mod.id,
        label: mod.label,
        descricao: mod.descricao,
        registros,
        temDados: registros > 0,
        somenteNavegador,
        localStorageKeys: mod.localStorageKeys,
        localStoragePrefixos: mod.localStoragePrefixos ?? [],
      };
    });

    return NextResponse.json({ modulos });
  } catch (err) {
    console.error("[backup/modulos GET]", err);
    return NextResponse.json(
      { error: "Não foi possível listar os módulos." },
      { status: 500 }
    );
  }
}
