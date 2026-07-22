"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Settings } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { lerZoomDocumento } from "@/lib/dropdown-portal-pos";
import type { ConfigListagemPersistida } from "@/lib/listagem-config";
import type { OpcaoOrdenacaoLista } from "@/hooks/use-listagem-paginada";

export type ExtraConfigLista = {
  chave: string;
  label: string;
};

const LARGURA_MENU = 220;

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

type PosicaoMenu = { top: number; left: number };

function calcularPosicaoMenu(
  anchor: HTMLElement,
  alinhar: "esquerda" | "direita"
): PosicaoMenu {
  const rect = anchor.getBoundingClientRect();
  const zoom = lerZoomDocumento();
  const gap = 4;
  let left =
    alinhar === "direita" ? rect.right / zoom - LARGURA_MENU : rect.left / zoom;
  const maxLeft = window.innerWidth / zoom - LARGURA_MENU - 8;
  left = Math.max(8, Math.min(left, maxLeft));
  return {
    top: rect.bottom / zoom + gap,
    left,
  };
}

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
  const botaoRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [posicao, setPosicao] = useState<PosicaoMenu | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const atualizarPosicao = useCallback(() => {
    if (!botaoRef.current) return;
    setPosicao(calcularPosicaoMenu(botaoRef.current, alinharMenu));
  }, [alinharMenu]);

  useEffect(() => {
    if (!aberto) return;
    atualizarPosicao();
    function aoScrollOuResize() {
      atualizarPosicao();
    }
    window.addEventListener("resize", aoScrollOuResize);
    window.addEventListener("scroll", aoScrollOuResize, true);
    return () => {
      window.removeEventListener("resize", aoScrollOuResize);
      window.removeEventListener("scroll", aoScrollOuResize, true);
    };
  }, [aberto, atualizarPosicao]);

  useEffect(() => {
    if (!aberto) return;
    function fecharAoClicarFora(event: MouseEvent) {
      const alvo = event.target as Node;
      if (botaoRef.current?.contains(alvo)) return;
      if (menuRef.current?.contains(alvo)) return;
      onFechar();
    }
    document.addEventListener("mousedown", fecharAoClicarFora);
    return () => document.removeEventListener("mousedown", fecharAoClicarFora);
  }, [aberto, onFechar]);

  const menu =
    aberto && mounted && posicao
      ? createPortal(
          <div
            ref={menuRef}
            role="dialog"
            aria-label={t("producao.listagem.configTitulo")}
            className="fixed z-[10050] rounded border border-slate-200 bg-white p-3 shadow-lg"
            style={{
              top: posicao.top,
              left: posicao.left,
              width: LARGURA_MENU,
              minWidth: LARGURA_MENU,
            }}
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
                    className="h-8 min-w-0 rounded border border-slate-300 bg-white px-2 text-[11px] text-slate-700 outline-none focus:border-primary-500"
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
                      onAlterarDirecao(
                        e.target.value as ConfigListagemPersistida<C>["direcao"]
                      )
                    }
                    className="h-8 min-w-0 rounded border border-slate-300 bg-white px-2 text-[11px] text-slate-700 outline-none focus:border-primary-500"
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
          </div>,
          document.body
        )
      : null;

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <button
        ref={botaoRef}
        type="button"
        onClick={onToggle}
        className={
          variante === "controle"
            ? "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            : "inline-flex h-[34px] items-center gap-0.5 rounded border border-slate-300 bg-white px-2 text-slate-500 shadow-sm hover:bg-slate-50"
        }
        aria-expanded={aberto}
        aria-haspopup="dialog"
        title={t("producao.listagem.configurar")}
      >
        <Settings className={variante === "controle" ? "h-3.5 w-3.5" : "h-4 w-4"} />
        {variante !== "controle" && <ChevronDown className="h-3 w-3" />}
      </button>
      {menu}
    </div>
  );
}
