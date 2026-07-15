import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Cookie só pode ser limpo em Route Handler — redireciona para a API. */
export default function LogoutPage() {
  redirect("/api/auth/logout?redirect=/login");
}
