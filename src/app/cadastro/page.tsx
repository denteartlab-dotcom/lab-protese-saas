import { CriarContaForm } from "@/components/cadastro/CriarContaForm";
import { obterAppBuildIdServidor } from "@/lib/app-build-id-servidor";

export const dynamic = "force-dynamic";

export const revalidate = 0;

export default function CadastroPage() {
  const buildId = obterAppBuildIdServidor();

  return <CriarContaForm versaoSeloAsaas={buildId} />;
}
