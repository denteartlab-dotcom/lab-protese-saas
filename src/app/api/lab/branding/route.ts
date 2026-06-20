import { NextResponse } from "next/server";
import {
  brandingPlataformaLogin,
  carregarBrandingLaboratorioPorEmail,
  carregarBrandingLaboratorioPorSlug,
} from "@/lib/lab-branding";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const slug = params.get("slug")?.trim().toLowerCase() || "";
    const email = params.get("email")?.trim().toLowerCase() || "";

    if (slug) {
      const branding = await carregarBrandingLaboratorioPorSlug(slug);
      if (!branding) {
        return NextResponse.json(
          { error: "Laboratório não encontrado." },
          { status: 404 }
        );
      }
      return NextResponse.json(branding, {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    if (email) {
      const branding = await carregarBrandingLaboratorioPorEmail(email);
      if (!branding) {
        return NextResponse.json(
          { error: "Nenhum laboratório identificado para este e-mail." },
          { status: 404 }
        );
      }
      return NextResponse.json(branding, {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    return NextResponse.json(brandingPlataformaLogin(), {
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
