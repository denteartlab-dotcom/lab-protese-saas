import { redirect } from "next/navigation";

export default function DisparosWhatsappRedirectPage() {
  redirect("/app/configuracoes?aba=mensagens");
}
