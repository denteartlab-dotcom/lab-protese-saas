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
      // "/login" aqui significa sem acesso — deixa o formulário aparecer (sem loop).
      if (destino !== "/login") {
        redirect(destino);
      }
    }
    // Sem contexto (ex.: assinatura vencida/RLS): mostra o formulário.
    // NUNCA redirecionar para /app nem fazer logout aqui — isso criava loop infinito.
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
