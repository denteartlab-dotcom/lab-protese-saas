import { redirect } from "next/navigation";
import { Suspense } from "react";
import { I18nProvider } from "@/components/i18n-provider";
import { getSession } from "@/lib/auth";
import { carregarBrandingLaboratorio } from "@/lib/lab-branding";
import { carregarConfigLaboratorioServidor } from "@/lib/lab-config-servidor";
import { configParaLabImpressao } from "@/lib/lab-logo";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  searchParams: Promise<{ redirect?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const session = await getSession();
  if (session) {
    const params = await searchParams;
    const destino =
      params.redirect && params.redirect.startsWith("/app")
        ? params.redirect
        : "/app";
    redirect(destino);
  }

  const [configLaboratorio, branding] = await Promise.all([
    carregarConfigLaboratorioServidor(),
    carregarBrandingLaboratorio(),
  ]);
  const lab = configParaLabImpressao(configLaboratorio);

  return (
    <I18nProvider>
      <Suspense>
        <div className="login-hero-shell flex flex-1 flex-col">
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
