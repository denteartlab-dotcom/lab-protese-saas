import { redirect } from "next/navigation";
import { Suspense } from "react";
import { I18nProvider } from "@/components/i18n-provider";
import { getSession } from "@/lib/auth";
import { obterDestinoPosLogin } from "@/lib/contexto-assinatura-vencida";
import { carregarBrandingLoginServidor } from "@/lib/login-branding-servidor";
import { LoginForm } from "./LoginForm";

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
    const padrao = await obterDestinoPosLogin(session.empresaId);
    let destino = padrao;
    if (padrao.startsWith("/app") && params.redirect?.startsWith("/app")) {
      destino = params.redirect;
    }
    redirect(destino);
  }

  const { brandingInicial, brandingLaboratorio, jaEntrou } =
    await carregarBrandingLoginServidor(params);

  return (
    <I18nProvider>
      <Suspense>
        <div className="login-hero-shell flex flex-1 flex-col">
          <LoginForm
            brandingInicial={brandingInicial}
            brandingLaboratorio={brandingLaboratorio}
            jaEntrouInicial={jaEntrou}
          />
        </div>
      </Suspense>
    </I18nProvider>
  );
}
