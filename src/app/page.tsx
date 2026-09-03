import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { obterDestinoPosLogin } from "@/lib/contexto-assinatura-vencida";

export const dynamic = "force-dynamic";

/** Temporário: landing desativada — entrada só pelo login. */
export default async function HomePage() {
  const session = await getSession();
  if (session?.empresaId) {
    const destino = await obterDestinoPosLogin(session.empresaId);
    if (destino !== "/login") {
      redirect(destino);
    }
  }
  redirect("/login");
}
