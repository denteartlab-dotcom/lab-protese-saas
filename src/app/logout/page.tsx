import { redirect } from "next/navigation";
import { destroySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LogoutPage() {
  await destroySession();
  redirect("/login");
}
