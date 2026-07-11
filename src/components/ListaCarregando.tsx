"use client";

import { useTrUi } from "@/lib/i18n/use-tr-ui";

type Props = {
  colSpan: number;
  mensagem?: string;
};

export function ListaCarregando({
  colSpan,
  mensagem = "Carregando...",
}: Props) {
  const { tr } = useTrUi();
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-8 text-center text-slate-400">
        {tr(mensagem)}
      </td>
    </tr>
  );
}

export function PainelCarregando({ mensagem = "Carregando..." }: { mensagem?: string }) {
  const { tr } = useTrUi();
  return (
    <div className="flex min-h-[120px] items-center justify-center rounded border border-slate-100 bg-white px-4 py-10 text-center text-[11px] text-slate-400">
      {tr(mensagem)}
    </div>
  );
}
