type Props = {
  colSpan: number;
  mensagem?: string;
};

export function ListaCarregando({
  colSpan,
  mensagem = "Carregando...",
}: Props) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-8 text-center text-slate-400">
        {mensagem}
      </td>
    </tr>
  );
}

export function PainelCarregando({ mensagem = "Carregando..." }: { mensagem?: string }) {
  return (
    <div className="flex min-h-[120px] items-center justify-center rounded border border-slate-100 bg-white px-4 py-10 text-center text-[11px] text-slate-400">
      {mensagem}
    </div>
  );
}
