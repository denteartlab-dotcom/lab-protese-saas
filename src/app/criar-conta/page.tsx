import { redirect } from "next/navigation";

/** Temporário: cadastro público desativado. */
export default function CriarContaPage() {
  redirect("/login");
}
