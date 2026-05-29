import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PermissoesAppProvider } from "@/components/PermissoesAppProvider";
import { obterContextoAppServidor } from "@/lib/contexto-app-servidor";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await obterContextoAppServidor();
  if (!ctx) redirect("/login");

  return (
    <PermissoesAppProvider
      acessoTotal={ctx.acessoTotal}
      permissoesModulos={ctx.permissoesModulos}
    >
      <AppShell userName={ctx.user.name} userRole={ctx.user.role} initialLab={ctx.lab}>
        {children}
      </AppShell>
    </PermissoesAppProvider>
  );
}
