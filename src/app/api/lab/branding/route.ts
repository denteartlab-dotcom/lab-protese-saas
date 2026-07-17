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
      // Sempre 200 (lab ou genérico) — evita oráculo de existência de slug.
      const branding =
        (await carregarBrandingLaboratorioPorSlug(slug)) ??
        brandingPlataformaLogin();
      return NextResponse.json(branding, {
        headers: { "Cache-Control": CACHE_BRANDING },
      });
    }

    if (email) {
      // Sempre 200 com branding (lab ou genérico) — evita oráculo de existência de e-mail.
      const branding = await carregarBrandingLaboratorioPorEmail(email);
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
