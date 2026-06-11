import { NextResponse } from "next/server";
import { carregarBrandingLaboratorio } from "@/lib/lab-branding";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const branding = await carregarBrandingLaboratorio();
    return NextResponse.json(branding, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível carregar os dados do laboratório." },
      { status: 500 }
    );
  }
}
