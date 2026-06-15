import { redirect } from "next/navigation";
import { getMasterSession } from "@/lib/master-auth";
import { MasterShell } from "@/components/admin-master/MasterShell";
import { AdminMasterPainel } from "@/components/admin-master/AdminMasterPainel";

export default async function AdminMasterPage() {
  const session = await getMasterSession();
  if (!session) redirect("/admin-master/login");

  return (
    <MasterShell masterName={session.name}>
      <AdminMasterPainel />
    </MasterShell>
  );
}
