import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AssinaturaVencidaPainel } from "@/components/assinatura/AssinaturaVencidaPainel";
import { getSession } from "@/lib/auth";
import { obterContextoAssinaturaVencida, obterDestinoPosLogin } from "@/lib/contexto-assinatura-vencida";

export const dynamic = "force-dynamic";

export default async function AssinaturaVencidaPage() {
  const session = await getSession();
  if (!session?.empresaId) redirect("/login");

  const ctx = await obterContextoAssinaturaVencida();
  if (!ctx) {
    const destino = await obterDestinoPosLogin(session.empresaId);
    if (destino.startsWith("/app")) redirect(destino);
    redirect("/login");
  }

  return <AssinaturaVencidaPainel contexto={ctx} />;
}
