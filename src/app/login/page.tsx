import { Suspense } from "react";
import { I18nProvider } from "@/components/i18n-provider";
import { carregarBrandingLaboratorio } from "@/lib/lab-branding";
import { carregarConfigLaboratorioServidor } from "@/lib/lab-config-servidor";
import { configParaLabImpressao } from "@/lib/lab-logo";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LoginPage() {
  const [configLaboratorio, branding] = await Promise.all([
    carregarConfigLaboratorioServidor(),
    carregarBrandingLaboratorio(),
  ]);
  const lab = configParaLabImpressao(configLaboratorio);

  return (
    <I18nProvider>
      <Suspense>
        <div className="flex min-h-0 flex-1 flex-col">
          <LoginForm
            brandingInicial={{
              lab: {
                ...lab,
                logoDataUrl: branding.logoDataUrl || lab.logoDataUrl,
                logoTamanho: branding.logoTamanho ?? lab.logoTamanho,
              },
              nomeLaboratorio: branding.nomeLaboratorio,
              marcaSubtitulo: branding.marcaSubtitulo || lab.marcaSubtitulo,
            }}
          />
        </div>
      </Suspense>
    </I18nProvider>
  );
}
