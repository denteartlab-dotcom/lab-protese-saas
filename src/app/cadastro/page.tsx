import { CriarContaForm } from "@/components/cadastro/CriarContaForm";
import { I18nProvider } from "@/components/i18n-provider";
import { obterAppBuildIdServidor } from "@/lib/app-build-id-servidor";

export const dynamic = "force-dynamic";

export const revalidate = 0;

export default function CadastroPage() {
  const buildId = obterAppBuildIdServidor();

  return (
    <I18nProvider>
      <CriarContaForm versaoSeloAsaas={buildId} />
    </I18nProvider>
  );
}
