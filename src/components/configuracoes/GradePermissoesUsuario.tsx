"use client";

import {
  SECOES_MENU_PERMISSOES,
  type MenuPermissaoSecao,
} from "@/lib/usuarios-menu-permissoes";
import type { PermissaoCrud } from "@/lib/usuarios-sistema";
import { cn } from "@/lib/utils";

type Props = {
  modulos: Record<string, PermissaoCrud>;
  onChange: (modulos: Record<string, PermissaoCrud>) => void;
  somenteLeitura?: boolean;
};

type ColunaAcao = keyof PermissaoCrud;

const colunas: { key: ColunaAcao; label: string }[] = [
  { key: "ver", label: "Ver" },
  { key: "criar", label: "Criar" },
  { key: "editar", label: "Editar" },
  { key: "excluir", label: "Excluir" },
];

export function GradePermissoesUsuario({ modulos, onChange, somenteLeitura }: Props) {
  function atualizar(id: string, coluna: ColunaAcao, valor: boolean) {
    if (somenteLeitura) return;
    onChange({
      ...modulos,
      [id]: {
        ...(modulos[id] ?? { ver: false, criar: false, editar: false, excluir: false }),
        [coluna]: valor,
      },
    });
  }

  return (
    <div className="overflow-x-auto border border-[#e5e7eb]">
      <table className="w-full min-w-[720px] border-collapse text-[11px]">
        <thead>
          <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
            <th className="px-3 py-2 text-left font-semibold text-[#6b7280]"> </th>
            {colunas.map((col) => (
              <th
                key={col.key}
                className="w-[72px] px-2 py-2 text-center font-semibold text-[#6b7280]"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SECOES_MENU_PERMISSOES.map((secao) => (
            <SecaoGrade
              key={secao.id}
              secao={secao}
              modulos={modulos}
              somenteLeitura={somenteLeitura}
              atualizar={atualizar}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SecaoGrade({
  secao,
  modulos,
  somenteLeitura,
  atualizar,
}: {
  secao: MenuPermissaoSecao;
  modulos: Record<string, PermissaoCrud>;
  somenteLeitura?: boolean;
  atualizar: (id: string, coluna: ColunaAcao, valor: boolean) => void;
}) {
  return (
    <>
      <tr className="bg-[#eef1f5]">
        <td
          colSpan={5}
          className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[#374151]"
        >
          {secao.titulo}
        </td>
      </tr>
      {secao.itens.map((item) => (
        <tr key={item.id} className="border-b border-[#f3f4f6] hover:bg-[#fafafa]">
          <td className="px-3 py-1.5 text-[11px] text-[#374151]">{item.label}</td>
          {colunas.map((col) => (
            <td key={col.key} className="px-2 py-1.5 text-center">
              <input
                type="checkbox"
                className={cn(
                  "h-3.5 w-3.5 rounded-sm border-[#d1d5db] accent-[#4a90d9]",
                  somenteLeitura && "cursor-not-allowed opacity-60"
                )}
                checked={Boolean(modulos[item.id]?.[col.key])}
                disabled={somenteLeitura}
                onChange={(e) => atualizar(item.id, col.key, e.target.checked)}
                aria-label={`${item.label} — ${col.label}`}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
