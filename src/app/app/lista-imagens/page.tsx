import { redirect } from "next/navigation";

/** Alias Smart Prótese: /lista-imagens → /liberar-espaco */
export default function ListaImagensRedirectPage() {
  redirect("/app/liberar-espaco");
}
