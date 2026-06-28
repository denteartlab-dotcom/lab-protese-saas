"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Check, ChevronDown, Plus } from "lucide-react";
import { calcularPosicaoMenuAbaixo } from "@/lib/dropdown-portal-pos";
import type { EntidadeDespesa } from "@/lib/lancamento-despesa";
import { propsBloquearArrasteEntreCampos } from "@/lib/input-selecao";
import { cn } from "@/lib/utils";

const AZUL_SELECAO = "#4a90d9";
const VERDE_CADASTRAR = "#2e9e5b";

type Opcao = { id: string; nome: string };

const CADASTRO_POR_TIPO: Partial<
  Record<Exclude<EntidadeDespesa, "todos">, { label: string; href: string }>
> = {
  fornecedores: {
    label: "Adicionar Fornecedor",
    href: "/app/cadastros/fornecedores",
  },
  colaboradores: {
    label: "Adicionar Colaborador",
    href: "/app/cadastros/colaboradores",
  },
  prestadores: {
    label: "Adicionar Prestador de Serviço",
    href: "/app/cadastros/prestadores",
  },
  entregadores: {
    label: "Adicionar Entregador",
    href: "/app/cadastros/entregadores",
  },
  clientes: {
    label: "Adicionar Cliente",
    href: "/app/clientes",
  },
};

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
  options: Opcao[];
  tipoEntidade: Exclude<EntidadeDespesa, "todos">;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  menuEmPortal?: boolean;
};

export function EntidadeDespesaSelect({
  label,
  value,
  onChange,
  options,
  tipoEntidade,
  placeholder = "Selecione",
  required,
  disabled,
  className,
  inputClassName,
  menuEmPortal = true,
}: Props) {
  const autoId = useId();
  const inputId = autoId;
  const menuId = `${inputId}-menu`;
  const ref = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0, maxHeight: 240 });

  const cadastro = CADASTRO_POR_TIPO[tipoEntidade];

  const labelSelecionado = useMemo(
    () => options.find((opcao) => opcao.id === value)?.nome ?? "",
    [options, value]
  );

  const filtrados = useMemo(() => {
    const termo = normalizarBusca(texto);
    if (!termo) return options;
    return options.filter((opcao) => normalizarBusca(opcao.nome).includes(termo));
  }, [options, texto]);

  const sincronizarTexto = useCallback(() => {
    setTexto(labelSelecionado);
  }, [labelSelecionado]);

  useEffect(() => {
    if (!aberto) sincronizarTexto();
  }, [aberto, sincronizarTexto]);

  const atualizarPosMenu = useCallback(() => {
    if (!menuEmPortal) return;
    const anchor = anchorRef.current ?? ref.current;
    if (!anchor) return;
    setMenuPos(calcularPosicaoMenuAbaixo(anchor, { alturaMaxima: 240 }));
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

  function selecionar(opcao: Opcao) {
    onChange(opcao.id);
    setTexto(opcao.nome);
    setAberto(false);
  }

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
    "h-9 w-full rounded border border-[#d4d4d4] bg-white py-2 pl-3 pr-8 text-[12px] outline-none focus:border-[#4a90d9] focus:ring-1 focus:ring-[#4a90d9]",
    !value && !aberto ? "text-slate-400" : "text-slate-800",
    disabled && "cursor-not-allowed bg-slate-50 opacity-60",
    inputClassName
  );

  const menu = aberto ? (
    <div
      id={menuId}
      role="listbox"
      className={cn(
        "overflow-hidden border border-[#d4d4d4] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.12)]",
        menuEmPortal ? "fixed z-[10050]" : "absolute left-0 right-0 top-full z-[100] mt-0"
      )}
      style={
        menuEmPortal
          ? {
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
              maxHeight: menuPos.maxHeight,
            }
          : { maxHeight: 240 }
      }
    >
      {cadastro ? (
        <Link
          href={cadastro.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setAberto(false)}
          className="flex w-full items-center gap-1 border-b border-[#e8e8e8] px-3 py-2 text-left text-[12px] font-medium hover:bg-slate-50"
          style={{ color: VERDE_CADASTRAR }}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          {cadastro.label}
        </Link>
      ) : null}

      <ul className="max-h-[200px] overflow-y-auto py-1">
        {filtrados.length === 0 ? (
          <li className="px-3 py-2 text-[12px] text-slate-400">Nenhum resultado.</li>
        ) : (
          filtrados.map((opcao) => {
            const ativo = opcao.id === value;
            return (
              <li key={opcao.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={ativo}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selecionar(opcao)}
                  className={cn(
                    "flex min-h-[34px] w-full items-center gap-2 px-3 py-2 text-left text-[13px]",
                    ativo ? "font-medium text-white" : "text-slate-800 hover:bg-slate-50"
                  )}
                  style={ativo ? { backgroundColor: AZUL_SELECAO } : undefined}
                >
                  {ativo ? (
                    <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} aria-hidden />
                  ) : (
                    <span className="w-3.5 shrink-0" aria-hidden />
                  )}
                  <span className="truncate">{opcao.nome}</span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  ) : null;

  return (
    <div ref={ref} className={cn("relative", className)}>
      {label ? (
        <label htmlFor={inputId} className="mb-1 block text-[11px] font-medium text-slate-600">
          {label}
        </label>
      ) : null}
      <div ref={anchorRef} className="relative">
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
