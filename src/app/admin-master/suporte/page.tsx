import { redirect } from "next/navigation";
import { getMasterSession } from "@/lib/master-auth";
import { MasterShell } from "@/components/admin-master/MasterShell";
import { SuporteChatMaster } from "@/components/admin-master/SuporteChatMaster";

export default async function AdminMasterSuportePage() {
  const session = await getMasterSession();
  if (!session) redirect("/admin-master/login");

  return (
    <MasterShell masterName={session.name}>
      <SuporteChatMaster />
    </MasterShell>
  );
}
