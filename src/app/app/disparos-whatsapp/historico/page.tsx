"use client";

import Link from "next/link";
import { HistoricoDisparosConteudo } from "@/components/disparos-whatsapp/HistoricoDisparosConteudo";

export default function HistoricoDisparosPage() {
  return (
    <div className="min-h-full bg-[#f4f6f9] pb-8 dark:bg-slate-950">
      <div className="mx-auto max-w-[1400px] px-4 pt-4 md:px-6 md:pt-5">
        <p className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          <Link href="/app/clientes" className="hover:text-[#4a90d9]">
            Cadastros
          </Link>
          <span>/</span>
          <Link href="/app/disparos-whatsapp" className="hover:text-[#4a90d9]">
            Disparos WhatsApp
          </Link>
          <span>/</span>
          <span className="text-slate-700 dark:text-slate-300">Histórico</span>
        </p>
        <HistoricoDisparosConteudo voltarHref="/app/disparos-whatsapp" />
      </div>
    </div>
  );
}
