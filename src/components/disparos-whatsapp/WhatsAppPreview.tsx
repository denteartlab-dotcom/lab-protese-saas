"use client";

import { aplicarVariaveisMensagem } from "@/lib/whatsapp-disparos/mensagem-variaveis";

export function WhatsAppPreview({ mensagem }: { mensagem: string }) {
  const preview = aplicarVariaveisMensagem(mensagem, {
    nome: "Maria Silva",
    telefone: "(31) 99999-8888",
    cidade: "Belo Horizonte",
    empresa: "Clínica Odonto Vida",
    dentista: "Dr. João",
    consulta: "15/07/2026 às 14h",
    valor: "R$ 350,00",
    vencimento: "20/07/2026",
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-[#e5ddd5] p-4 dark:border-slate-700">
      <p className="mb-3 text-xs font-medium text-slate-600">Pré-visualização WhatsApp</p>
      <div className="mx-auto max-w-[280px] rounded-lg bg-[#dcf8c6] px-3 py-2 text-[13px] leading-relaxed text-slate-800 shadow-sm">
        {preview.split("\n").map((linha, i) => (
          <span key={i}>
            {linha}
            <br />
          </span>
        ))}
        <p className="mt-1 text-right text-[10px] text-slate-500">19:42</p>
      </div>
    </div>
  );
}
