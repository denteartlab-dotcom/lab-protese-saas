import { cookies } from "next/headers";
import { JA_ENTROU_COOKIE, ULTIMO_LAB_SLUG_COOKIE } from "@/lib/auth-client";
import {
  brandingPlataformaLogin,
  brandingPublicoParaLoginForm,
  carregarBrandingLaboratorioPorSlug,
  type LabBrandingPublico,
} from "@/lib/lab-branding";
import { analisarCaminhoApp } from "@/lib/rotas-app";

export function resolverSlugBrandingLogin(params: {
  lab?: string;
  slug?: string;
  redirect?: string;
}): string {
  const direto = params.lab?.trim() || params.slug?.trim();
  if (direto) return direto.toLowerCase();

  const redirect = params.redirect?.trim();
  if (redirect?.startsWith("/app")) {
    const { slug } = analisarCaminhoApp(redirect);
    if (slug) return slug;
  }

  return "";
}

export async function carregarBrandingLoginServidor(params: {
  lab?: string;
  slug?: string;
  redirect?: string;
}): Promise<{
  brandingInicial: ReturnType<typeof brandingPublicoParaLoginForm>;
  brandingLaboratorio: LabBrandingPublico | null;
  jaEntrou: boolean;
}> {
  const cookieStore = await cookies();
  const jaEntrou = cookieStore.get(JA_ENTROU_COOKIE)?.value === "1";
  const plataforma = brandingPlataformaLogin();

  if (!jaEntrou) {
    return {
      brandingInicial: brandingPublicoParaLoginForm(plataforma),
      brandingLaboratorio: null,
      jaEntrou: false,
    };
  }

  let slug = resolverSlugBrandingLogin(params);

  if (!slug) {
    const slugCookie = cookieStore.get(ULTIMO_LAB_SLUG_COOKIE)?.value?.trim().toLowerCase() || "";
    slug = slugCookie;
  }

  if (!slug) {
    return {
      brandingInicial: brandingPublicoParaLoginForm(plataforma),
      brandingLaboratorio: null,
      jaEntrou,
    };
  }

  const laboratorio = await carregarBrandingLaboratorioPorSlug(slug);
  if (!laboratorio) {
    return {
      brandingInicial: brandingPublicoParaLoginForm(plataforma),
      brandingLaboratorio: null,
      jaEntrou,
    };
  }

  return {
    brandingInicial: brandingPublicoParaLoginForm(laboratorio),
    brandingLaboratorio: laboratorio,
    jaEntrou,
  };
}
