import { nomeExibicaoLaboratorio } from "@/lib/configuracoes-lab";
import { NOME_LAB_PADRAO } from "@/lib/document-title";
import { carregarConfigLaboratorioServidor } from "@/lib/lab-config-servidor";
import { LAB_IMPRESSAO_PADRAO } from "@/lib/lab-impressao";
import { configParaLabImpressao } from "@/lib/lab-logo";
import { prisma } from "@/lib/db";

export type LabBrandingPublico = {
  nomeLaboratorio: string;
  marcaSubtitulo: string;
  logoDataUrl: string;
  logoTamanho: number;
  empresaSlug?: string;
};

/** Branding genérico da plataforma — login sem laboratório identificado. */
export const BRANDING_PLATAFORMA_LOGIN: LabBrandingPublico = {
  nomeLaboratorio: NOME_LAB_PADRAO,
  marcaSubtitulo:
    LAB_IMPRESSAO_PADRAO.marcaSubtitulo || "Sistema para Laboratórios",
  logoDataUrl: "/logo-lab-protese.png",
  logoTamanho: 0,
};

export function brandingPlataformaLogin(): LabBrandingPublico {
  return { ...BRANDING_PLATAFORMA_LOGIN };
}

export function brandingPublicoParaLoginForm(branding: LabBrandingPublico) {
  return {
    lab: {
      marca: branding.nomeLaboratorio,
      marcaSubtitulo: branding.marcaSubtitulo,
      responsavel: "",
      endereco: "",
      enderecoLinha1: "",
      enderecoLinha2: "",
      telefones: "",
      email: "",
      logoDataUrl: branding.logoDataUrl,
      logoTamanho: branding.logoTamanho,
    },
    nomeLaboratorio: branding.nomeLaboratorio,
    marcaSubtitulo: branding.marcaSubtitulo,
  };
}

function montarBrandingPublico(
  config: Awaited<ReturnType<typeof carregarConfigLaboratorioServidor>>,
  nomeFallback: string,
  empresaSlug?: string
): LabBrandingPublico {
  const lab = configParaLabImpressao(config);
  const nome =
    config.nomeLaboratorio?.trim() ||
    nomeFallback.trim() ||
    nomeExibicaoLaboratorio(config).trim() ||
    NOME_LAB_PADRAO;

  return {
    nomeLaboratorio: nome,
    marcaSubtitulo: lab.marcaSubtitulo?.trim() || "",
    logoDataUrl: lab.logoDataUrl?.trim() || "",
    logoTamanho: lab.logoTamanho ?? 0,
    ...(empresaSlug ? { empresaSlug } : {}),
  };
}

export async function carregarBrandingLaboratorioPorSlug(
  slug: string
): Promise<LabBrandingPublico | null> {
  const empresa = await prisma.empresa.findUnique({
    where: { slug: slug.trim().toLowerCase() },
    select: { id: true, nome: true, slug: true },
  });
  if (!empresa) return null;

  const config = await carregarConfigLaboratorioServidor(empresa.id);
  return montarBrandingPublico(config, empresa.nome, empresa.slug);
}

export async function carregarBrandingLaboratorioPorEmail(
  email: string
): Promise<LabBrandingPublico | null> {
  const normalizado = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizado)) return null;

  const usuarios = await prisma.user.findMany({
    where: { email: normalizado, excluidoEm: null },
    select: {
      empresa: { select: { id: true, nome: true, slug: true } },
    },
  });

  const empresas = new Map<string, { id: string; nome: string; slug: string }>();
  for (const usuario of usuarios) {
    if (!usuario.empresa) continue;
    empresas.set(usuario.empresa.slug, usuario.empresa);
  }
  if (empresas.size !== 1) return null;

  const empresa = [...empresas.values()][0];
  const config = await carregarConfigLaboratorioServidor(empresa.id);
  return montarBrandingPublico(config, empresa.nome, empresa.slug);
}

export async function carregarBrandingLaboratorio(): Promise<LabBrandingPublico> {
  return brandingPlataformaLogin();
}
