"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";
import { calcularPosicaoMenuAbaixo } from "@/lib/dropdown-portal-pos";
import type { ProdutoCatalogo } from "@/lib/produtos-catalogo";
import { cn } from "@/lib/utils";

const VERDE_CADASTRAR = "#2e9e5b";

type Props = {
  value: string;
  produtos: ProdutoCatalogo[];
  onChange: (produto: ProdutoCatalogo) => void;
  labelFallback?: string;
  triggerClassName?: string;
  menuEmPortal?: boolean;
  disabled?: boolean;
};

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function ProdutoEstoqueSelect({
  value,
  produtos,
  onChange,
  labelFallback = "",
  triggerClassName,
  menuEmPortal = true,
  disabled = false,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0, maxHeight: 240 });
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selecionado = useMemo(
    () => produtos.find((produto) => produto.id === value),
    [produtos, value]
  );

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return produtos;
    return produtos.filter((produto) => {
      const nome = produto.nome.toLowerCase();
      const marca = (produto.marca || "").toLowerCase();
      const codigo = (produto.codigoBarras || "").toLowerCase();
      return nome.includes(termo) || marca.includes(termo) || codigo.includes(termo);
    });
  }, [busca, produtos]);

  const atualizarPosMenu = useCallback(() => {
    if (!menuEmPortal || !triggerRef.current) return;
    setMenuPos(calcularPosicaoMenuAbaixo(triggerRef.current, { alturaMaxima: 280 }));
  }, [menuEmPortal]);

  useLayoutEffect(() => {
    if (!aberto || !menuEmPortal) return;
    atualizarPosMenu();
    window.addEventListener("resize", atualizarPosMenu);
    window.addEventListener("scroll", atualizarPosMenu, true);
    return () => {
      window.removeEventListener("resize", atualizarPosMenu);
      window.removeEventListener("scroll", atualizarPosMenu, true);
    };
  }, [aberto, menuEmPortal, atualizarPosMenu]);

  useEffect(() => {
    if (!aberto) return;
    function fechar(e: MouseEvent) {
      const alvo = e.target as Node;
      if (ref.current?.contains(alvo)) return;
      const menu = document.getElementById("produto-estoque-select-menu");
      if (menu?.contains(alvo)) return;
      setAberto(false);
    }
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [aberto]);

  function selecionar(produto: ProdutoCatalogo) {
    onChange(produto);
    setAberto(false);
    setBusca("");
  }

  const triggerCls = cn(
    "flex h-9 w-full items-center justify-between gap-2 rounded border border-[#d4d4d4] bg-white px-2.5 text-left text-[12px] text-slate-800 outline-none focus:border-[#4a90d9] disabled:cursor-not-allowed disabled:opacity-60",
    triggerClassName
  );

  const menu = aberto ? (
    <div
      id="produto-estoque-select-menu"
      role="listbox"
      className={cn(
        "overflow-hidden border border-[#d4d4d4] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.12)]",
        menuEmPortal ? "fixed z-[10050]" : "absolute left-0 right-0 top-full z-[100] mt-0.5"
      )}
      style={
        menuEmPortal
          ? {
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
              maxHeight: menuPos.maxHeight,
            }
          : { maxHeight: 280 }
      }
    >
      <Link
        href="/app/produtos"
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => setAberto(false)}
        className="flex w-full items-center gap-1 border-b border-[#e8e8e8] px-3 py-2 text-left text-[12px] font-medium hover:bg-slate-50"
        style={{ color: VERDE_CADASTRAR }}
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
        Cadastrar Produto
      </Link>

      <div className="border-b border-[#e8e8e8] p-2">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar produto..."
          className="h-8 w-full rounded border border-slate-200 px-2 text-[12px] outline-none focus:border-[#4a90d9]"
          autoFocus
        />
      </div>

      <ul className="max-h-[220px] overflow-y-auto py-1">
        {filtrados.map((produto) => {
          const ativo = produto.id === value;
          return (
            <li key={produto.id}>
              <button
                type="button"
                role="option"
                aria-selected={ativo}
                onClick={() => selecionar(produto)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12px] hover:bg-slate-50",
                  ativo && "bg-[#e8f2fc] font-medium text-[#4a90d9]"
                )}
              >
                <span className="truncate text-slate-800">{produto.nome}</span>
                <span className="shrink-0 text-slate-500">
                  {money(produto.valorCusto || 0)}
                </span>
              </button>
            </li>
          );
        })}
        {filtrados.length === 0 ? (
          <li className="px-3 py-2 text-[12px] text-slate-400">Nenhum produto encontrado.</li>
        ) : null}
      </ul>
    </div>
  ) : null;

  return (
    <div ref={ref} className="relative min-w-[140px]">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setAberto((v) => !v);
        }}
        className={triggerCls}
        aria-haspopup="listbox"
        aria-expanded={aberto}
      >
        <span className={cn("truncate", !selecionado && !labelFallback && "text-slate-400")}>
          {selecionado?.nome || labelFallback || "Selecione"}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-slate-400 transition-transform",
            aberto && "rotate-180"
          )}
        />
      </button>

      {menuEmPortal && menu ? createPortal(menu, document.body) : menu}
    </div>
  );
}
