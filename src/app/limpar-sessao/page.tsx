import { destroySession } from "@/lib/auth";
import { LimparSessaoCliente } from "./LimparSessaoCliente";

export const dynamic = "force-dynamic";

export default async function LimparSessaoPage() {
  await destroySession();
  return <LimparSessaoCliente />;
}
