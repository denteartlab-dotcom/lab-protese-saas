"use client";

import { ModuloCabecalho } from "@/components/ModuloCabecalho";
import { useI18n } from "@/components/i18n-provider";
import { HistoricoDisparosConteudo } from "@/components/disparos-whatsapp/HistoricoDisparosConteudo";

export default function HistoricoDisparosPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-full bg-[#f9fafb] pb-10">
      <div className="mx-auto max-w-[1400px] px-4 pt-4 md:px-6 md:pt-5">
        <ModuloCabecalho
          moduloKey="nav.disparosWhatsapp"
          tituloKey="cadastros.disparosWhatsapp.historico"
          hrefModulo="/app/disparos-whatsapp"
          className="mb-4"
        />
        <HistoricoDisparosConteudo voltarHref="/app/disparos-whatsapp" />
      </div>
    </div>
  );
}
