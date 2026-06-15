import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PermissoesAppProvider } from "@/components/PermissoesAppProvider";
import { getSession } from "@/lib/auth";
import { obterDestinoPosLogin } from "@/lib/contexto-assinatura-vencida";
import { obterContextoAppServidor } from "@/lib/contexto-app-servidor";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (session?.empresaId) {
    const destino = await obterDestinoPosLogin(session.empresaId);
    if (destino === "/assinatura-vencida") redirect(destino);
  }

  const ctx = await obterContextoAppServidor();
  if (!ctx) {
    redirect("/login");
  }

  return (
    <PermissoesAppProvider
      acessoTotal={ctx.acessoTotal}
      permissoesModulos={ctx.permissoesModulos}
    >
      <AppShell
        userName={ctx.user.name}
        userRole={ctx.user.role}
        userEmail={ctx.user.email}
        isMasterAdmin={ctx.isMasterAdmin}
        dataVencimentoAssinatura={ctx.empresa.dataVencimento}
        suporteWhatsapp={ctx.suporteWhatsapp}
        initialLab={ctx.lab}
      >
        {children}
      </AppShell>
    </PermissoesAppProvider>
  );
}
