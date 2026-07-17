import { redirect } from "next/navigation";
import { Suspense } from "react";
import { I18nProvider } from "@/components/i18n-provider";
import { getSession } from "@/lib/auth";
import { obterDestinoPosLogin } from "@/lib/contexto-assinatura-vencida";
import { obterAppBuildIdServidor } from "@/lib/app-build-id-servidor";
import { obterEmpresaContexto } from "@/lib/empresa-context";
import { carregarBrandingLoginServidor } from "@/lib/login-branding-servidor";
import { LoginForm } from "./LoginForm";
import { LoginLoadingFallback } from "./LoginLoadingFallback";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  searchParams: Promise<{
    redirect?: string;
    lab?: string;
    slug?: string;
    cadastro?: string;
  }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const session = await getSession();
  const params = await searchParams;

  if (session?.empresaId) {
    const contexto = await obterEmpresaContexto({ persistirCookie: false });
    if (contexto) {
      const padrao = await obterDestinoPosLogin(session.empresaId);
      let destino = padrao;
      if (padrao.startsWith("/app") && params.redirect?.startsWith("/app")) {
        destino = params.redirect;
      }
      redirect(destino);
    }

    // Cookie JWT válido: NÃO fazer logout (isso apagava a sessão após /app falhar por RLS).
    // Tenta entrar pelo slug do JWT; se não houver, mostra o formulário.
    const slug = session.empresaSlug?.trim();
    if (slug) {
      redirect(`/app/${slug}`);
    }
  }

  const { brandingInicial, brandingLaboratorio, jaEntrou } =
    await carregarBrandingLoginServidor(params);
  const buildId = obterAppBuildIdServidor();

  return (
    <I18nProvider>
      <Suspense fallback={<LoginLoadingFallback />}>
        <div className="login-hero-shell flex flex-1 flex-col">
          <LoginForm
            brandingInicial={brandingInicial}
            brandingLaboratorio={brandingLaboratorio}
            jaEntrouInicial={jaEntrou}
            versaoSeloAsaas={buildId}
          />
        </div>
      </Suspense>
    </I18nProvider>
  );
}
