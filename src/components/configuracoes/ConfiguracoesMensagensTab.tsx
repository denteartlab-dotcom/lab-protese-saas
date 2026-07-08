"use client";

import { useSearchParams } from "next/navigation";
import { DisparosWhatsappConteudo } from "@/components/disparos-whatsapp/DisparosWhatsappConteudo";
import { HistoricoDisparosConteudo } from "@/components/disparos-whatsapp/HistoricoDisparosConteudo";

export function ConfiguracoesMensagensTab() {
  const searchParams = useSearchParams();
  const historico = searchParams.get("historico") === "1";

  if (historico) {
    return <HistoricoDisparosConteudo voltarHref="/app/configuracoes?aba=mensagens" />;
  }

  return (
    <DisparosWhatsappConteudo
      embedded
      historicoHref="/app/configuracoes?aba=mensagens&historico=1"
    />
  );
}
