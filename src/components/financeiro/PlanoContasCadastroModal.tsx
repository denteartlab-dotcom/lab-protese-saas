"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Layers } from "lucide-react";
import {
  agruparPlanoContas,
  filtrarPorSecao,
  type ItemPlanoContas,
  type SecaoPlanoContas,
} from "@/lib/plano-contas";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  secao: SecaoPlanoContas;
  itens: ItemPlanoContas[];
  categoriaInicial: ItemPlanoContas | null;
  onClose: () => void;
  onCadastrar: (pai: ItemPlanoContas, nome: string) => void;
};

const inputClass =
  "h-9 w-full rounded border border-[#d4d4d4] bg-white px-2.5 text-[13px] text-slate-800 outline-none focus:border-[#4a90d9]";

const AZUL_GRUPO = "#4a90d9";
const BG_GRUPO = "#e8f2fc";

function CategoriaPertencenteSelect({
  grupos,
  itensSecao,
  value,
  onChange,
}: {
  grupos: ReturnType<typeof agruparPlanoContas>;
  itensSecao: ItemPlanoContas[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selecionado = itensSecao.find((item) => item.id === value) ?? null;

  useEffect(() => {
    if (!aberto) return;
    function fechar(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [aberto]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={cn(
          inputClass,
          "flex items-center justify-between gap-2 text-left"
        )}
        aria-haspopup="listbox"
        aria-expanded={aberto}
      >
        <span className="truncate">{selecionado?.nome ?? ""}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-slate-400 transition-transform",
            aberto && "rotate-180"
          )}
        />
      </button>

      {aberto ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-0 max-h-[220px] overflow-y-auto border border-[#d4d4d4] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.12)]"
        >
          {grupos.map((grupo) => (
            <div key={grupo.topico.id}>
              <div
                className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide"
                style={{ backgroundColor: BG_GRUPO, color: AZUL_GRUPO }}
              >
                {grupo.topico.nome}
              </div>
              {grupo.filhos.map((filho) => {
                const ativo = filho.id === value;
                return (
                  <button
                    key={filho.id}
                    type="button"
                    role="option"
                    aria-selected={ativo}
                    onClick={() => {
                      onChange(filho.id);
                      setAberto(false);
                    }}
                    className={cn(
                      "block w-full px-3 py-2 text-left text-[13px] text-slate-800",
                      ativo ? "font-normal" : "font-normal hover:bg-slate-50"
                    )}
                    style={ativo ? { backgroundColor: BG_GRUPO } : undefined}
                  >
                    {filho.nome}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function PlanoContasCadastroModal({
  open,
  secao,
  itens,
  categoriaInicial,
  onClose,
  onCadastrar,
}: Props) {
  const [portalPronto, setPortalPronto] = useState(false);
  const [categoriaId, setCategoriaId] = useState("");
  const [nome, setNome] = useState("");

  const itensSecao = useMemo(
    () => filtrarPorSecao(itens, secao),
    [itens, secao]
  );
  const grupos = useMemo(
    () => agruparPlanoContas(itensSecao),
    [itensSecao]
  );

  useEffect(() => {
    setPortalPronto(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setCategoriaId(categoriaInicial?.id ?? "");
    setNome("");
  }, [open, categoriaInicial?.id]);

  if (!open || !portalPronto) return null;

  const categoriaSelecionada =
    itensSecao.find((item) => item.id === categoriaId) ?? null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoriaSelecionada || !nome.trim()) return;
    onCadastrar(categoriaSelecionada, nome.trim());
    onClose();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[10060] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-10"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plano-contas-cadastro-titulo"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className="relative my-auto w-full max-w-[520px] rounded border border-[#d4d4d4] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-between border-b border-[#e5e5e5] px-4 py-3">
          <h2
            id="plano-contas-cadastro-titulo"
            className="text-[15px] font-normal text-slate-800"
          >
            Cadastrar Plano de Contas
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-lg leading-none text-slate-400 hover:text-slate-600"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 py-4">
          <div className="mb-4 flex items-center gap-2 text-[13px] text-slate-600">
            <Layers className="h-4 w-4 text-slate-400" strokeWidth={1.75} />
            <span>Dados do Plano de Contas</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[12px] text-slate-700">
                Categoria Pertencente<span className="text-red-500">*</span>
              </label>
              <CategoriaPertencenteSelect
                grupos={grupos}
                itensSecao={itensSecao}
                value={categoriaId}
                onChange={setCategoriaId}
              />
            </div>

            <div>
              <label className="mb-1 block text-[12px] text-slate-700">
                Nome<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2 border-t border-[#e5e5e5] pt-4">
            <button
              type="submit"
              disabled={!categoriaSelecionada || !nome.trim()}
              className="h-9 rounded border border-[#4a90d9] bg-[#4a90d9] px-5 text-[13px] text-white hover:bg-[#3d7fc4] disabled:opacity-50"
            >
              Cadastrar
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded border border-[#d4d4d4] bg-white px-5 text-[13px] text-slate-700 hover:bg-slate-50"
            >
              Fechar
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
