"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { DisparosWhatsappConteudo } from "@/components/disparos-whatsapp/DisparosWhatsappConteudo";
import { ChatbotConfigConteudo } from "@/components/disparos-whatsapp/ChatbotConfigConteudo";

const ABAS = [
  { id: "disparos", label: "Disparos" },
  { id: "chatbot", label: "Chatbot" },
] as const;

type AbaId = (typeof ABAS)[number]["id"];

function DisparosWhatsappPagina() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const abaParam = searchParams.get("aba");
  const abaAtiva: AbaId = abaParam === "chatbot" ? "chatbot" : "disparos";

  return (
    <div className="min-h-full bg-[#f9fafb] pb-10">
      <div className="mx-auto max-w-[1440px] px-4 py-5 md:px-6 md:py-6">
        <div className="mb-5 flex flex-wrap gap-2 border-b border-slate-200">
          {ABAS.map((aba) => {
            const ativa = abaAtiva === aba.id;
            const href = aba.id === "disparos" ? pathname : `${pathname}?aba=${aba.id}`;
            return (
              <Link
                key={aba.id}
                href={href}
                className={[
                  "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors -mb-px",
                  ativa
                    ? "border-indigo-600 text-indigo-700"
                    : "border-transparent text-slate-500 hover:text-slate-800",
                ].join(" ")}
              >
                {aba.label}
              </Link>
            );
          })}
          <Link
            href="/app/disparos-whatsapp/historico"
            className="ml-auto border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-800 -mb-px"
          >
            Histórico
          </Link>
        </div>

        {abaAtiva === "chatbot" ? <ChatbotConfigConteudo /> : <DisparosWhatsappConteudo />}
      </div>
    </div>
  );
}

export default function DisparosWhatsappPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-full bg-[#f9fafb] px-6 py-10 text-sm text-slate-500">
          Carregando…
        </div>
      }
    >
      <DisparosWhatsappPagina />
    </Suspense>
  );
}
