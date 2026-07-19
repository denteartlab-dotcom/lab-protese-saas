"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import { calcularPosicaoMenuAbaixo } from "@/lib/dropdown-portal-pos";
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
const AZUL_SELECAO = "#4a90d9";
const BG_GRUPO = "#e8f2fc";
const VERDE_CADASTRAR = "#2e9e5b";

function normalizarBusca(texto: string) {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

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
  const [busca, setBusca] = useState("");
  const [modalCadastro, setModalCadastro] = useState(false);
  const [categoriaInicialCadastro, setCategoriaInicialCadastro] =
    useState<ItemPlanoContas | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0, maxHeight: 280 });
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);

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

  const gruposFiltrados = useMemo(() => {
    const termo = normalizarBusca(busca);
    const base = grupos.filter((grupo) => grupo.filhos.length > 0);
    if (!termo) return base;
    return base
      .map((grupo) => ({
        ...grupo,
        filhos: grupo.filhos.filter((filho) =>
          normalizarBusca(filho.nome).includes(termo)
        ),
      }))
      .filter((grupo) => grupo.filhos.length > 0);
  }, [grupos, busca]);

  const atualizarPosMenu = useCallback(() => {
    if (!menuEmPortal || !triggerRef.current) return;
    setMenuPos(calcularPosicaoMenuAbaixo(triggerRef.current, { alturaMaxima: 420 }));
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
    window.setTimeout(() => buscaRef.current?.focus(), 0);
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    function fechar(e: MouseEvent) {
      const alvo = e.target as Node;
      if (ref.current?.contains(alvo)) return;
      const menu = document.getElementById("plano-contas-categoria-menu");
      if (menu?.contains(alvo)) return;
      setAberto(false);
      setBusca("");
    }
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [aberto]);

  function selecionar(filho: ItemPlanoContas) {
    onChange(filho.nome);
    setAberto(false);
    setBusca("");
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
    setBusca("");
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

  function alternarAberto() {
    setAberto((v) => {
      if (v) setBusca("");
      return !v;
    });
  }

  const triggerCls = cn(
    "flex h-9 w-full items-center justify-between gap-2 rounded border border-[#d4d4d4] bg-white px-2.5 text-left text-[13px] text-slate-800 outline-none focus:border-[#4a90d9]",
    !value && "text-slate-400",
    triggerClassName
  );

  const menu = aberto ? (
    <div
      id="plano-contas-categoria-menu"
      role="listbox"
      className={cn(
        "flex flex-col overflow-hidden border border-[#d4d4d4] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.12)]",
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
              maxHeight: menuPos.maxHeight,
            }
          : { maxHeight: 420 }
      }
    >
      <button
        type="button"
        onClick={abrirCadastro}
        className="flex w-full shrink-0 items-center gap-1 border-b border-[#e8e8e8] px-3 py-2 text-left text-[12px] font-medium hover:bg-slate-50"
        style={{ color: VERDE_CADASTRAR }}
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
        Cadastrar Categoria
      </button>

      <div className="shrink-0 border-b border-[#e8e8e8] p-2">
        <input
          ref={buscaRef}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar categoria..."
          className="h-8 w-full rounded border border-slate-200 px-2 text-[12px] outline-none focus:border-[#4a90d9]"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {gruposFiltrados.length === 0 ? (
          <p className="px-3 py-2 text-[12px] text-slate-400">Nenhuma categoria encontrada.</p>
        ) : (
          gruposFiltrados.map((grupo) => (
            <div key={grupo.topico.id}>
              <div
                className="sticky top-0 z-[1] px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide"
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
                      !ativo && "hover:bg-slate-50"
                    )}
                    style={ativo ? { backgroundColor: AZUL_SELECAO } : undefined}
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={ativo}
                      onClick={() => selecionar(filho)}
                      className={cn(
                        "flex min-w-0 flex-1 items-center gap-2 py-2 pl-3 pr-1 text-left text-[13px]",
                        ativo ? "font-medium text-white" : "text-slate-800"
                      )}
                    >
                      {ativo ? (
                        <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} aria-hidden />
                      ) : (
                        <span className="w-3.5 shrink-0" aria-hidden />
                      )}
                      <span className="truncate">{filho.nome}</span>
                    </button>
                    {podeExcluir ? (
                      <button
                        type="button"
                        title="Excluir categoria"
                        onClick={(e) => excluirConta(filho, e)}
                        className={cn(
                          "inline-flex h-7 w-7 shrink-0 items-center justify-center hover:bg-red-50 hover:text-red-600",
                          ativo ? "text-white/90" : "text-red-500"
                        )}
                        aria-label="Excluir categoria"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  ) : null;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={alternarAberto}
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

      {menuEmPortal && menu ? createPortal(menu, document.body) : menu}

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
