import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing/LandingPage";
import { getSession } from "@/lib/auth";
import { obterDestinoPosLogin } from "@/lib/contexto-assinatura-vencida";
import { obterAppBuildIdServidor } from "@/lib/app-build-id-servidor";
import { NOME_LAB_PADRAO } from "@/lib/document-title";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${NOME_LAB_PADRAO} — Gestão para Laboratórios de Prótese`,
  description:
    "Organize trabalhos, produção, financeiro, clientes e entregas em uma única plataforma. Teste grátis por 14 dias.",
};

export default async function HomePage() {
  const session = await getSession();
  if (session?.empresaId) {
    // obterDestinoPosLogin já degrada para "/login" se DB/RLS falhar (não 500).
    const destino = await obterDestinoPosLogin(session.empresaId);
    if (destino !== "/login") {
      redirect(destino);
    }
  }

  const buildId = obterAppBuildIdServidor();

  return <LandingPage versaoSeloAsaas={buildId} />;
}
