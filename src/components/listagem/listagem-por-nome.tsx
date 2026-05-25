"use client";

import type { ReactNode } from "react";
import { BarraConfigListagem } from "./BarraConfigListagem";
import { useListagemPaginada } from "@/hooks/use-listagem-paginada";
import { compararTextoBr } from "@/lib/listagem-config";

type ItemComNome = { nome: string };

type Props<T extends ItemComNome> = {
  storageKey: string;
  itens: T[];
  opcoesExtras?: { valor: keyof T & string; label: string; comparar: (a: T, b: T) => number }[];
  embutido?: boolean;
  children: (itensPagina: T[]) => ReactNode;
};

/** Lista ordenável/paginável com engrenagem — padrão ordenar por nome. */
export function ListagemPorNome<T extends ItemComNome>({
  storageKey,
  itens,
  opcoesExtras = [],
  embutido = true,
  children,
}: Props<T>) {
  type Campo = "nome" | (keyof T & string);

  const comparadores: Record<string, (a: T, b: T) => number> = {
    nome: (a, b) => compararTextoBr(a.nome, b.nome),
  };
  for (const opcao of opcoesExtras) {
    comparadores[opcao.valor] = opcao.comparar;
  }

  const opcoesOrdenacao = [
    { valor: "nome" as Campo, label: "Nome" },
    ...opcoesExtras.map((o) => ({ valor: o.valor as Campo, label: o.label })),
  ];

  const listagem = useListagemPaginada<T, Campo>({
    storageKey,
    itens,
    padrao: { ordenarPor: "nome", direcao: "asc", porPagina: 50 },
    comparadores: comparadores as Record<Campo, (a: T, b: T) => number>,
  });

  return (
    <BarraConfigListagem
      embutido={embutido}
      configAberto={listagem.configAberto}
      onToggleConfig={() =>
        listagem.configAberto ? listagem.fecharConfig() : listagem.abrirConfig()
      }
      onFecharConfig={listagem.fecharConfig}
      rascunho={listagem.rascunho}
      opcoesOrdenacao={opcoesOrdenacao}
      onAlterarOrdenarPor={(valor) => listagem.atualizarRascunho({ ordenarPor: valor })}
      onAlterarDirecao={(direcao) => listagem.atualizarRascunho({ direcao })}
      onAlterarPorPagina={(porPagina) => listagem.atualizarRascunho({ porPagina })}
      onGravarConfig={listagem.gravarConfig}
      pagina={listagem.pagina}
      totalPaginas={listagem.totalPaginas}
      onPagina={listagem.setPagina}
      totalItens={listagem.totalItens}
    >
      {children(listagem.itensPagina)}
    </BarraConfigListagem>
  );
}
