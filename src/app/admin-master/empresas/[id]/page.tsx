import { redirect } from "next/navigation";
import { getMasterSession } from "@/lib/master-auth";
import { MasterShell } from "@/components/admin-master/MasterShell";
import { VisualizarEmpresaMaster } from "@/components/admin-master/VisualizarEmpresaMaster";

type Props = { params: Promise<{ id: string }> };

export default async function VisualizarEmpresaPage({ params }: Props) {
  const session = await getMasterSession();
  if (!session) redirect("/admin-master/login");
  const { id } = await params;

  return (
    <MasterShell masterName={session.name}>
      <VisualizarEmpresaMaster empresaId={id} />
    </MasterShell>
  );
}
