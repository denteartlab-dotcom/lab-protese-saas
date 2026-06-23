"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";
import { propsBloquearArrasteEntreCampos } from "@/lib/input-selecao";
import { cn } from "@/lib/utils";

export type OpcaoSelectPesquisavel = {
  value: string;
  label: string;
};

const ALTURA_ITEM_PX = 34;
const MAX_ITENS_VISIVEIS = 10;

function normalizarBusca(texto: string) {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

type Props = {
  label?: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: OpcaoSelectPesquisavel[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  menuEmPortal?: boolean;
  id?: string;
  emptyMessage?: string;
  maxItensVisiveis?: number;
  /** Exibe botão X para limpar quando há valor selecionado. */
  permitirLimpar?: boolean;
  /** Valor aplicado ao limpar (padrão: ""). */
  valorLimpar?: string;
};

export function SelectPesquisavel({
  label,
  value,
  onChange,
  options,
  placeholder = "Selecione...",
  required,
  disabled,
  className,
  inputClassName,
  menuEmPortal = false,
  id,
  emptyMessage = "Nenhum resultado.",
  maxItensVisiveis = MAX_ITENS_VISIVEIS,
  permitirLimpar = false,
  valorLimpar = "",
}: Props) {
  const autoId = useId();
  const inputId = id || autoId;
  const menuId = `${inputId}-menu`;
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });

  const labelSelecionado = useMemo(
    () => options.find((opcao) => opcao.value === value)?.label ?? "",
    [options, value]
  );

  const filtrados = useMemo(() => {
    const termo = normalizarBusca(texto);
    if (!termo) return options;
    return options.filter((opcao) => normalizarBusca(opcao.label).includes(termo));
  }, [options, texto]);

  const maxAlturaMenu = maxItensVisiveis * ALTURA_ITEM_PX;

  const sincronizarTexto = useCallback(() => {
    setTexto(labelSelecionado);
  }, [labelSelecionado]);

  useEffect(() => {
    if (!aberto) sincronizarTexto();
  }, [aberto, sincronizarTexto]);

  useEffect(() => {
    if (!aberto) return;
    function atualizarPos() {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom,
        left: rect.left,
        width: rect.width,
      });
    }
    atualizarPos();
    window.addEventListener("resize", atualizarPos);
    window.addEventListener("scroll", atualizarPos, true);
    return () => {
      window.removeEventListener("resize", atualizarPos);
      window.removeEventListener("scroll", atualizarPos, true);
    };
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    function fechar(e: MouseEvent) {
      const alvo = e.target as Node;
      if (ref.current?.contains(alvo)) return;
      const menu = document.getElementById(menuId);
      if (menu?.contains(alvo)) return;
      setAberto(false);
    }
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [aberto, menuId]);

  function abrirLista() {
    if (disabled) return;
    setAberto(true);
    setTexto("");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function selecionar(opcao: OpcaoSelectPesquisavel) {
    onChange(opcao.value);
    setTexto(opcao.label);
    setAberto(false);
  }

  function limparSelecao() {
    onChange(valorLimpar);
    setTexto("");
    setAberto(false);
    inputRef.current?.blur();
  }

  const exibirLimpar = permitirLimpar && value !== valorLimpar;

  function onBlurInput() {
    window.setTimeout(() => {
      setAberto(false);
      sincronizarTexto();
    }, 150);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setAberto(false);
      sincronizarTexto();
      return;
    }
    if (e.key === "Enter" && aberto && filtrados.length > 0) {
      e.preventDefault();
      selecionar(filtrados[0]);
    }
  }

  const inputCls = cn(
    "w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 text-sm shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20",
    exibirLimpar ? "pr-14" : "pr-8",
    !value && !aberto ? "text-slate-400" : "text-slate-700",
    disabled && "cursor-not-allowed bg-slate-50 opacity-60",
    inputClassName
  );

  const menu = aberto ? (
    <div
      id={menuId}
      role="listbox"
      className={cn(
        "overflow-y-auto border border-slate-300 bg-white shadow-lg",
        menuEmPortal ? "fixed z-[10050]" : "absolute left-0 right-0 top-full z-[100] mt-0.5"
      )}
      style={{
        maxHeight: maxAlturaMenu,
        ...(menuEmPortal
          ? {
              top: menuPos.top + 2,
              left: menuPos.left,
              width: menuPos.width,
            }
          : undefined),
      }}
    >
      {filtrados.length === 0 ? (
        <p className="px-3 py-2 text-[12px] text-slate-400">{emptyMessage}</p>
      ) : (
        filtrados.map((opcao) => {
          const ativo = opcao.value === value;
          return (
            <button
              key={`${opcao.value}-${opcao.label}`}
              type="button"
              role="option"
              aria-selected={ativo}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selecionar(opcao)}
              className={cn(
                "flex min-h-[34px] w-full items-center justify-between gap-2 px-3 text-left text-[13px] text-slate-800 hover:bg-slate-50",
                ativo && "bg-[#e8f2fc] font-medium text-[#4a90d9]"
              )}
            >
              <span className="truncate">{opcao.label}</span>
              {ativo ? <Check className="h-4 w-4 shrink-0 text-[#4a90d9]" aria-hidden /> : null}
            </button>
          );
        })
      )}
    </div>
  ) : null;

  return (
    <div ref={ref} className={cn("relative space-y-1", className)}>
      {label ? (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      ) : null}
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={aberto ? texto : labelSelecionado || ""}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          onChange={(e) => {
            setTexto(e.target.value);
            if (!aberto) setAberto(true);
          }}
          onFocus={() => {
            if (disabled) return;
            setAberto(true);
            setTexto("");
          }}
          onBlur={onBlurInput}
          onKeyDown={onKeyDown}
          className={inputCls}
          {...propsBloquearArrasteEntreCampos()}
        />
        {exibirLimpar ? (
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={limparSelecao}
            className="absolute right-7 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
            aria-label="Limpar seleção"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={abrirLista}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 disabled:opacity-40"
          aria-label="Abrir lista"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", aberto && "rotate-180")} />
        </button>
        {required ? (
          <input
            tabIndex={-1}
            aria-hidden
            required
            value={value}
            readOnly
            className="pointer-events-none absolute h-0 w-0 opacity-0"
            onChange={() => {}}
          />
        ) : null}
      </div>
      {menuEmPortal && menu ? createPortal(menu, document.body) : menu}
    </div>
  );
}
