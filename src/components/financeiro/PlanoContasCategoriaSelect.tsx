"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import {
  agruparPlanoContas,
  carregarPlanoContas,
  contaCriadaPeloUsuario,
  filtrarPorSecao,
  inserirContaPlano,
  PLANO_CONTAS_ATUALIZADO_EVENT,
  removerContaPlano,
  salvarPlanoContas,
  type ItemPlanoContas,
  type SecaoPlanoContas,
} from "@/lib/plano-contas";
import { PlanoContasCadastroModal } from "@/components/financeiro/PlanoContasCadastroModal";
import { cn } from "@/lib/utils";

const AZUL_GRUPO = "#4a90d9";
const BG_GRUPO = "#e8f2fc";
const VERDE_CADASTRAR = "#2e9e5b";

type Props = {
  secao: SecaoPlanoContas;
  value: string;
  onChange: (nome: string) => void;
  className?: string;
  triggerClassName?: string;
  required?: boolean;
  /** Evita corte do menu dentro de modais com scroll. */
  menuEmPortal?: boolean;
};

export function PlanoContasCategoriaSelect({
  secao,
  value,
  onChange,
  className,
  triggerClassName,
  required,
  menuEmPortal = false,
}: Props) {
  const [itens, setItens] = useState<ItemPlanoContas[]>([]);
  const [aberto, setAberto] = useState(false);
  const [modalCadastro, setModalCadastro] = useState(false);
  const [categoriaInicialCadastro, setCategoriaInicialCadastro] =
    useState<ItemPlanoContas | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const recarregar = useCallback(() => {
    setItens(carregarPlanoContas());
  }, []);

  useEffect(() => {
    recarregar();
    const handler = () => recarregar();
    window.addEventListener(PLANO_CONTAS_ATUALIZADO_EVENT, handler);
    return () =>
      window.removeEventListener(PLANO_CONTAS_ATUALIZADO_EVENT, handler);
  }, [recarregar]);

  const itensSecao = useMemo(
    () => filtrarPorSecao(itens, secao),
    [itens, secao]
  );
  const grupos = useMemo(
    () => agruparPlanoContas(itensSecao),
    [itensSecao]
  );

  useEffect(() => {
    if (!aberto) return;
    function atualizarPos() {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
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
      const menu = document.getElementById("plano-contas-categoria-menu");
      if (menu?.contains(alvo)) return;
      setAberto(false);
    }
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [aberto]);

  function selecionar(filho: ItemPlanoContas) {
    onChange(filho.nome);
    setAberto(false);
  }

  function excluirConta(item: ItemPlanoContas, e: React.MouseEvent) {
    e.stopPropagation();
    if (!contaCriadaPeloUsuario(item)) return;
    const atualizados = removerContaPlano(itens, item);
    salvarPlanoContas(atualizados);
    setItens(atualizados);
    if (value === item.nome) onChange("");
  }

  function abrirCadastro(e: React.MouseEvent) {
    e.stopPropagation();
    setCategoriaInicialCadastro(null);
    setModalCadastro(true);
    setAberto(false);
  }

  function cadastrarConta(pai: ItemPlanoContas, nome: string) {
    const atualizados = inserirContaPlano(itens, pai, nome);
    salvarPlanoContas(atualizados);
    setItens(atualizados);
    const prefixo = `${pai.codigo}.`;
    const novo = atualizados.find(
      (item) =>
        item.secao === secao &&
        item.nome === nome.trim() &&
        item.codigo.startsWith(prefixo)
    );
    if (novo) onChange(novo.nome);
  }

  const triggerCls = cn(
    "flex h-9 w-full items-center justify-between gap-2 rounded border border-[#d4d4d4] bg-white px-2.5 text-left text-[13px] text-slate-800 outline-none focus:border-[#4a90d9]",
    triggerClassName
  );

  const menu = aberto ? (
    <div
      id="plano-contas-categoria-menu"
      role="listbox"
      className={cn(
        "max-h-[240px] overflow-y-auto border border-[#d4d4d4] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.12)]",
        menuEmPortal
          ? "fixed z-[10050]"
          : "absolute left-0 right-0 top-full z-[100] mt-0"
      )}
      style={
        menuEmPortal
          ? {
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
            }
          : undefined
      }
    >
      <button
        type="button"
        onClick={abrirCadastro}
        className="flex w-full items-center gap-1 border-b border-[#e8e8e8] px-3 py-2 text-left text-[12px] font-medium hover:bg-slate-50"
        style={{ color: VERDE_CADASTRAR }}
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
        Cadastrar Categoria
      </button>

      {grupos.map((grupo) => (
        <div key={grupo.topico.id}>
          <div
            className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide"
            style={{ backgroundColor: BG_GRUPO, color: AZUL_GRUPO }}
          >
            {grupo.topico.nome}
          </div>
          {grupo.filhos.map((filho) => {
            const ativo = filho.nome === value;
            const podeExcluir = contaCriadaPeloUsuario(filho);
            return (
              <div
                key={filho.id}
                className={cn(
                  "flex min-h-[34px] items-center justify-between gap-1 pr-1",
                  ativo ? "" : "hover:bg-slate-50"
                )}
                style={ativo ? { backgroundColor: BG_GRUPO } : undefined}
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={ativo}
                  onClick={() => selecionar(filho)}
                  className="min-w-0 flex-1 py-2 pl-3 pr-1 text-left text-[13px] text-slate-800"
                >
                  {filho.nome}
                </button>
                {podeExcluir ? (
                  <button
                    type="button"
                    title="Excluir categoria"
                    onClick={(e) => excluirConta(filho, e)}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-red-500 hover:bg-red-50 hover:text-red-600"
                    aria-label="Excluir categoria"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  ) : null;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={triggerCls}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-required={required}
      >
        <span className="truncate">{value || "Selecione"}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-slate-400 transition-transform",
            aberto && "rotate-180"
          )}
        />
      </button>

      {menuEmPortal && menu
        ? createPortal(menu, document.body)
        : menu}

      <PlanoContasCadastroModal
        open={modalCadastro}
        secao={secao}
        itens={itens}
        categoriaInicial={categoriaInicialCadastro}
        onClose={() => setModalCadastro(false)}
        onCadastrar={cadastrarConta}
      />
    </div>
  );
}
