import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing/LandingPage";
import { getSession } from "@/lib/auth";
import { obterDestinoPosLogin } from "@/lib/contexto-assinatura-vencida";
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
    redirect(await obterDestinoPosLogin(session.empresaId));
  }

  return <LandingPage />;
}
