import { NextResponse } from "next/server";
import {
  brandingPlataformaLogin,
  carregarBrandingLaboratorioPorEmail,
  carregarBrandingLaboratorioPorSlug,
} from "@/lib/lab-branding";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Cache curto público — issue 021 (branding pouco muda entre requests). */
const CACHE_BRANDING = "public, max-age=60, stale-while-revalidate=300";

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
        headers: { "Cache-Control": CACHE_BRANDING },
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
        headers: { "Cache-Control": CACHE_BRANDING },
      });
    }

    return NextResponse.json(brandingPlataformaLogin(), {
      headers: { "Cache-Control": CACHE_BRANDING },
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível carregar os dados do laboratório." },
      { status: 500 }
    );
  }
}
