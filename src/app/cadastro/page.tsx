import { brandingPlataformaLogin } from "@/lib/lab-branding";
import { CriarContaForm } from "@/components/cadastro/CriarContaForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CadastroPage() {
  const branding = brandingPlataformaLogin();

  return (
    <CriarContaForm
      branding={{
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
      }}
    />
  );
}
