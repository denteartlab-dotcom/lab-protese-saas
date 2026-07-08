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
    <div className="h-full rounded-xl border border-slate-200 bg-white p-4">
      <p className="mb-3 text-sm font-semibold text-slate-800">Pré-visualização</p>
      <div
        className="mx-auto max-w-[260px] overflow-hidden rounded-2xl border border-slate-200 shadow-sm"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4d4d4' fill-opacity='0.25'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          backgroundColor: "#e5ddd5",
        }}
      >
        <div className="bg-[#075e54] px-3 py-2.5">
          <p className="text-xs font-medium text-white">WhatsApp</p>
        </div>
        <div className="min-h-[180px] p-3">
          <div className="ml-auto max-w-[92%] rounded-lg rounded-tr-none bg-[#dcf8c6] px-3 py-2 text-[13px] leading-relaxed text-slate-800 shadow-sm">
            {preview.split("\n").map((linha, i) => (
              <span key={i}>
                {linha}
                {i < preview.split("\n").length - 1 ? <br /> : null}
              </span>
            ))}
            <p className="mt-1 text-right text-[10px] text-slate-500">19:42 ✓✓</p>
          </div>
        </div>
      </div>
    </div>
  );
}
