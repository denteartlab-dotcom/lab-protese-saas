"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/components/i18n-provider";
import { ConfiguracaoListaGear, type ExtraConfigLista } from "./ConfiguracaoListaGear";
import { PaginacaoLista } from "./PaginacaoLista";
import type { ConfigListagemPersistida } from "@/lib/listagem-config";
import type { OpcaoOrdenacaoLista } from "@/hooks/use-listagem-paginada";

type Props<C extends string> = {
  configAberto: boolean;
  onToggleConfig: () => void;
  onFecharConfig: () => void;
  rascunho: ConfigListagemPersistida<C>;
  opcoesOrdenacao: OpcaoOrdenacaoLista<C>[];
  onAlterarOrdenarPor: (valor: C) => void;
  onAlterarDirecao: (valor: ConfigListagemPersistida<C>["direcao"]) => void;
  onAlterarPorPagina: (valor: number) => void;
  extras?: ExtraConfigLista[];
  onAlterarExtra?: (chave: string, valor: boolean) => void;
  onGravarConfig: () => void;
  pagina: number;
  totalPaginas: number;
  onPagina: (pagina: number) => void;
  totalItens?: number;
  /** Dentro de um card que já tem borda (ex.: Clientes). */
  embutido?: boolean;
  /** Engrenagem renderizada na toolbar (ex.: Controle de Produção). */
  ocultarGear?: boolean;
  varianteGear?: "padrao" | "controle";
  children: ReactNode;
};

/** Engrenagem + conteúdo da tabela + paginação (padrão Controle de Produção). */
export function BarraConfigListagem<C extends string>({
  configAberto,
  onToggleConfig,
  onFecharConfig,
  rascunho,
  opcoesOrdenacao,
  onAlterarOrdenarPor,
  onAlterarDirecao,
  onAlterarPorPagina,
  extras,
  onAlterarExtra,
  onGravarConfig,
  pagina,
  totalPaginas,
  onPagina,
  totalItens,
  embutido = false,
  ocultarGear = false,
  varianteGear = "padrao",
  children,
}: Props<C>) {
  const { t } = useI18n();
  const textoRegistros =
    totalItens !== undefined
      ? t("listagem.registros", {
          total: totalItens,
          plural: totalItens === 1 ? "" : "s",
        })
      : "";
  const textoPagina =
    totalItens !== undefined && totalPaginas > 1
      ? ` · ${t("listagem.paginaDe", { pagina, total: totalPaginas })}`
      : "";

  return (
    <div
      className={
        embutido
          ? "bg-white"
          : "overflow-hidden rounded border border-slate-200 bg-white shadow-sm"
      }
    >
      {!ocultarGear && (
        <div className="flex items-center gap-2 border-b border-slate-100 px-2 py-1.5">
          <ConfiguracaoListaGear
            variante={varianteGear}
            aberto={configAberto}
            onToggle={onToggleConfig}
            onFechar={onFecharConfig}
            rascunho={rascunho}
            opcoesOrdenacao={opcoesOrdenacao}
            onAlterarOrdenarPor={onAlterarOrdenarPor}
            onAlterarDirecao={onAlterarDirecao}
            onAlterarPorPagina={onAlterarPorPagina}
            extras={extras}
            onAlterarExtra={onAlterarExtra}
            onGravar={onGravarConfig}
          />
          {totalItens !== undefined && (
            <span className="text-[10px] text-slate-400">
              {textoRegistros}
              {textoPagina}
            </span>
          )}
        </div>
      )}
      {ocultarGear && totalItens !== undefined && totalPaginas > 1 && (
        <div className="border-b border-slate-100 px-2 py-1 text-right">
          <span className="text-[10px] text-slate-400">
            {textoRegistros} · {t("listagem.paginaDe", { pagina, total: totalPaginas })}
          </span>
        </div>
      )}
      {children}
      <PaginacaoLista pagina={pagina} totalPaginas={totalPaginas} onPagina={onPagina} />
    </div>
  );
}
