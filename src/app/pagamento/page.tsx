import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PagamentoAssinaturaPainel } from "@/components/assinatura/PagamentoAssinaturaPainel";
import { getSession } from "@/lib/auth";
import { obterContextoAssinaturaVencida, obterDestinoPosLogin } from "@/lib/contexto-assinatura-vencida";

export const dynamic = "force-dynamic";

export default async function PagamentoPage() {
  const session = await getSession();
  if (!session?.empresaId) redirect("/login");

  const ctx = await obterContextoAssinaturaVencida();
  if (!ctx) {
    const destino = await obterDestinoPosLogin(session.empresaId);
    redirect(destino.startsWith("/app") ? destino : "/assinatura-vencida");
  }

  return (
    <Suspense>
      <PagamentoAssinaturaPainel />
    </Suspense>
  );
}
