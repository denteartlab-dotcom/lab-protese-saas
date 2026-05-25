import { getSession } from "@/lib/auth";
import { ModuloProducaoColaborador } from "@/components/ModuloProducaoColaborador";

export default async function ModuloPage() {
  const session = await getSession();
  return (
    <ModuloProducaoColaborador
      userName={session?.name ?? "Usuário"}
      userRole={session?.role ?? "admin"}
    />
  );
}
