"use client";

import { useEffect, useRef } from "react";
import { ChevronDown, Settings } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import type { ConfigListagemPersistida } from "@/lib/listagem-config";
import type { OpcaoOrdenacaoLista } from "@/hooks/use-listagem-paginada";

export type ExtraConfigLista = {
  chave: string;
  label: string;
};

type Props<C extends string> = {
  aberto: boolean;
  onToggle: () => void;
  onFechar: () => void;
  rascunho: ConfigListagemPersistida<C>;
  opcoesOrdenacao: OpcaoOrdenacaoLista<C>[];
  onAlterarOrdenarPor: (valor: C) => void;
  onAlterarDirecao: (valor: ConfigListagemPersistida<C>["direcao"]) => void;
  onAlterarPorPagina: (valor: number) => void;
  extras?: ExtraConfigLista[];
  onAlterarExtra?: (chave: string, valor: boolean) => void;
  onGravar: () => void;
  className?: string;
  /** Botão compacto do Controle de Produção (quadrado, sem seta). */
  variante?: "padrao" | "controle";
  /** Alinha o painel sob a engrenagem (útil à direita da toolbar). */
  alinharMenu?: "esquerda" | "direita";
};

export function ConfiguracaoListaGear<C extends string>({
  aberto,
  onToggle,
  onFechar,
  rascunho,
  opcoesOrdenacao,
  onAlterarOrdenarPor,
  onAlterarDirecao,
  onAlterarPorPagina,
  extras,
  onAlterarExtra,
  onGravar,
  className = "",
  variante = "padrao",
  alinharMenu = "esquerda",
}: Props<C>) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fecharAoClicarFora(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onFechar();
      }
    }
    if (aberto) {
      document.addEventListener("mousedown", fecharAoClicarFora);
    }
    return () => document.removeEventListener("mousedown", fecharAoClicarFora);
  }, [aberto, onFechar]);

  return (
    <div ref={ref} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={onToggle}
        className={
          variante === "controle"
            ? "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            : "inline-flex h-8 items-center gap-0.5 rounded border border-slate-300 bg-white px-2 text-slate-500 shadow-sm hover:bg-slate-50"
        }
        aria-expanded={aberto}
        aria-haspopup="dialog"
        title={t("producao.listagem.configurar")}
      >
        <Settings className={variante === "controle" ? "h-3.5 w-3.5" : "h-4 w-4"} />
        {variante !== "controle" && <ChevronDown className="h-3 w-3" />}
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-label={t("producao.listagem.configTitulo")}
          className={
            alinharMenu === "direita"
              ? "absolute right-0 top-full z-50 mt-1 w-[min(100vw-2rem,220px)] rounded border border-slate-200 bg-white p-3 shadow-lg"
              : "absolute left-0 top-full z-50 mt-1 w-[min(100vw-2rem,220px)] rounded border border-slate-200 bg-white p-3 shadow-lg"
          }
        >
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-[10px] font-medium text-slate-500">
                {t("producao.listagem.ordenar")}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <select
                  value={rascunho.ordenarPor}
                  onChange={(e) => onAlterarOrdenarPor(e.target.value as C)}
                  className="h-8 rounded border border-slate-300 bg-white px-2 text-[11px] text-slate-700 outline-none focus:border-primary-500"
                >
                  {opcoesOrdenacao.map((opcao) => (
                    <option key={opcao.valor} value={opcao.valor}>
                      {opcao.label}
                    </option>
                  ))}
                </select>
                <select
                  value={rascunho.direcao}
                  onChange={(e) =>
                    onAlterarDirecao(e.target.value as ConfigListagemPersistida<C>["direcao"])
                  }
                  className="h-8 rounded border border-slate-300 bg-white px-2 text-[11px] text-slate-700 outline-none focus:border-primary-500"
                >
                  <option value="asc">{t("producao.listagem.crescente")}</option>
                  <option value="desc">{t("producao.listagem.decrescente")}</option>
                </select>
              </div>
            </div>

            <div>
              <p className="mb-1 text-[10px] font-medium text-slate-500">
                {t("producao.listagem.qtdPorPagina")}
              </p>
              <input
                type="number"
                min={1}
                max={500}
                value={rascunho.porPagina}
                onChange={(e) => onAlterarPorPagina(Number(e.target.value))}
                className="h-8 w-full rounded border border-slate-300 px-2 text-[11px] text-slate-700 outline-none focus:border-primary-500"
              />
            </div>

            {extras?.map((extra) => (
              <label
                key={extra.chave}
                className={
                  variante === "controle"
                    ? "flex cursor-pointer flex-col gap-1 text-[10px] text-slate-600"
                    : "flex cursor-pointer items-start gap-2 text-[10px] text-slate-600"
                }
              >
                {variante === "controle" ? (
                  <span className="font-medium text-slate-500">{extra.label}</span>
                ) : null}
                <input
                  type="checkbox"
                  checked={Boolean(rascunho.extras?.[extra.chave])}
                  onChange={(e) => onAlterarExtra?.(extra.chave, e.target.checked)}
                  className={
                    variante === "controle"
                      ? "h-3.5 w-3.5 accent-primary-600"
                      : "mt-0.5 h-3.5 w-3.5 shrink-0 accent-primary-600"
                  }
                />
                {variante !== "controle" ? <span>{extra.label}</span> : null}
              </label>
            ))}

            <button
              type="button"
              onClick={onGravar}
              className="h-8 w-full rounded bg-primary-600 text-[11px] font-semibold text-white hover:bg-primary-700"
            >
              {t("producao.listagem.gravar")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
