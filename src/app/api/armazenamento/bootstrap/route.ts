import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { bootstrapJsonStoreLaboratorio } from "@/lib/json-store-servidor";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const data = await bootstrapJsonStoreLaboratorio();
    return NextResponse.json({ data });
  } catch (err) {
    console.error("[armazenamento/bootstrap]", err);
    return NextResponse.json(
      { error: "Não foi possível carregar os dados do laboratório." },
      { status: 500 }
    );
  }
}
