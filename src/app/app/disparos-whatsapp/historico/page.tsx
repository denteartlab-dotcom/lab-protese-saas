import { redirect } from "next/navigation";

export default function HistoricoDisparosRedirectPage() {
  redirect("/app/configuracoes?aba=mensagens&historico=1");
}
