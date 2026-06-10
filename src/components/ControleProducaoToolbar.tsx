"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { usePageReady } from "@/hooks/use-page-ready";
import { readStorage, writeStorage } from "@/lib/persisted-storage";
import {
  CalendarDays,
  List,
  Send,
  Truck,
  Tv,
  Users,
} from "lucide-react";

export type ControleProducaoView =
  | "lista"
  | "agenda"
  | "comissoes"
  | "terceirizados"
  | "entregas";

const STORAGE_PRODUTOS = "labProteseControleProdutos";
const STORAGE_PRODUTOS_LEGADO = "labProteseControleProdutor";
const STORAGE_FICHAS_SEM_SERVICOS = "labProteseControleFichasSemServicos";

type Props = {
  viewAtiva: ControleProducaoView;
  produtos?: boolean;
  fichasSemServicos?: boolean;
  onProdutosChange?: (valor: boolean) => void;
  onFichasSemServicosChange?: (valor: boolean) => void;
  configLista?: ReactNode;
  /** Apenas Lista / Agenda / … (engrenagem e toggles ficam abaixo de Situação). */
  somenteNavegacao?: boolean;
  /** Barra à esquerda (ex.: Relatórios / Comissão Zero na tela de comissões). */
  barraEsquerda?: ReactNode;
};

function ToggleFiltro({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (valor: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer flex-col items-center gap-1">
      <span className="whitespace-nowrap text-[10px] leading-none text-slate-600">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? "bg-blue-500" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${
            checked ? "left-[18px]" : "left-0.5"
          }`}
        />
      </button>
    </label>
  );
}

function NavLink({
  href,
  icon,
  label,
  ativo,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  ativo?: boolean;
}) {
  if (ativo) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded bg-blue-500 px-3 py-1.5 text-[11px] font-medium text-white">
        {icon}
        {label}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-500 hover:text-blue-600"
    >
      {icon}
      {label}
    </Link>
  );
}

function usePreferenciasControle(
  produtosControlado: boolean | undefined,
  fichasControlado: boolean | undefined
) {
  const [produtosInterno, setProdutosInterno] = useState(false);
  const [fichasInterno, setFichasInterno] = useState(false);

  const preferenciasProntas = usePageReady(() => {
    if (produtosControlado !== undefined && fichasControlado !== undefined) return;
    if (typeof window === "undefined") return;
    try {
      const produtosSalvo =
        readStorage<string | null>(STORAGE_PRODUTOS, null) ??
        readStorage<string | null>(STORAGE_PRODUTOS_LEGADO, null);
      setProdutosInterno(produtosSalvo === "1");
      setFichasInterno(readStorage<string | null>(STORAGE_FICHAS_SEM_SERVICOS, null) === "1");
    } catch {
      setProdutosInterno(false);
      setFichasInterno(false);
    }
  });

  return {
    produtosInterno,
    fichasInterno,
    setProdutosInterno,
    setFichasInterno,
    preferenciasProntas,
  };
}

/** Engrenagem + toggles alinhados abaixo do filtro Situação. */
export function ControleProducaoFiltrosLista({
  configLista,
  produtos: produtosControlado,
  fichasSemServicos: fichasControlado,
  onProdutosChange,
  onFichasSemServicosChange,
}: {
  configLista?: ReactNode;
  produtos?: boolean;
  fichasSemServicos?: boolean;
  onProdutosChange?: (valor: boolean) => void;
  onFichasSemServicosChange?: (valor: boolean) => void;
}) {
  const {
    produtosInterno,
    fichasInterno,
    setProdutosInterno,
    setFichasInterno,
    preferenciasProntas,
  } = usePreferenciasControle(produtosControlado, fichasControlado);
  const produtos = produtosControlado ?? produtosInterno;
  const fichasSemServicos = fichasControlado ?? fichasInterno;

  function alterarProdutos(valor: boolean) {
    onProdutosChange?.(valor);
    if (produtosControlado === undefined) setProdutosInterno(valor);
    if (typeof window !== "undefined") {
      writeStorage(STORAGE_PRODUTOS, valor ? "1" : "0");
    }
  }

  function alterarFichasSemServicos(valor: boolean) {
    onFichasSemServicosChange?.(valor);
    if (fichasControlado === undefined) setFichasInterno(valor);
    if (typeof window !== "undefined") {
      writeStorage(STORAGE_FICHAS_SEM_SERVICOS, valor ? "1" : "0");
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-end gap-5">
      {configLista}
      {preferenciasProntas ? (
        <>
          <ToggleFiltro label="Produtos" checked={produtos} onChange={alterarProdutos} />
          <ToggleFiltro
            label="Fichas sem Serviços"
            checked={fichasSemServicos}
            onChange={alterarFichasSemServicos}
          />
        </>
      ) : null}
    </div>
  );
}

export function ControleProducaoToolbar({
  viewAtiva,
  produtos: produtosControlado,
  fichasSemServicos: fichasControlado,
  onProdutosChange,
  onFichasSemServicosChange,
  configLista,
  somenteNavegacao = false,
  barraEsquerda,
}: Props) {
  const {
    produtosInterno,
    fichasInterno,
    setProdutosInterno,
    setFichasInterno,
    preferenciasProntas,
  } = usePreferenciasControle(produtosControlado, fichasControlado);

  const produtos = produtosControlado ?? produtosInterno;
  const fichasSemServicos = fichasControlado ?? fichasInterno;

  function alterarProdutos(valor: boolean) {
    onProdutosChange?.(valor);
    if (produtosControlado === undefined) setProdutosInterno(valor);
    if (typeof window !== "undefined") {
      writeStorage(STORAGE_PRODUTOS, valor ? "1" : "0");
    }
  }

  function alterarFichasSemServicos(valor: boolean) {
    onFichasSemServicosChange?.(valor);
    if (fichasControlado === undefined) setFichasInterno(valor);
    if (typeof window !== "undefined") {
      writeStorage(STORAGE_FICHAS_SEM_SERVICOS, valor ? "1" : "0");
    }
  }

  const iconClass = "h-3.5 w-3.5 shrink-0";

  const navegacao = (
    <div className="flex flex-wrap items-center gap-3">
      <NavLink
        href="/app/producao/controle"
        label="Lista"
        ativo={viewAtiva === "lista"}
        icon={<List className={iconClass} />}
      />
      <NavLink
        href="/app/producao/agenda"
        label="Agenda"
        ativo={viewAtiva === "agenda"}
        icon={<CalendarDays className={iconClass} />}
      />
      <NavLink
        href="/app/producao/comissao"
        label="Comissões"
        ativo={viewAtiva === "comissoes"}
        icon={<Users className={iconClass} />}
      />
      <NavLink
        href="/app/producao/finalizadores"
        label="Prestadores De Serviços"
        ativo={viewAtiva === "terceirizados"}
        icon={<Send className={iconClass} />}
      />
      <NavLink
        href="/app/producao/entregas"
        label="Controle de Entregas"
        ativo={viewAtiva === "entregas"}
        icon={<Truck className={iconClass} />}
      />
      <NavLink
        href="/app/producao/modulo-tv"
        label="Módulo TV"
        ativo={false}
        icon={<Tv className={iconClass} />}
      />
    </div>
  );

  if (somenteNavegacao) {
    return (
      <div className="mb-3 flex flex-wrap items-center justify-end gap-3 border-b border-slate-100 pb-3">
        {navegacao}
      </div>
    );
  }

  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
      <div className="flex flex-wrap items-center gap-3">
        {barraEsquerda}
        {!barraEsquerda ? (
          <div className="flex flex-wrap items-end gap-5">
            {configLista}
            {preferenciasProntas ? (
              <>
                <ToggleFiltro label="Produtos" checked={produtos} onChange={alterarProdutos} />
                <ToggleFiltro
                  label="Fichas sem Serviços"
                  checked={fichasSemServicos}
                  onChange={alterarFichasSemServicos}
                />
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      {navegacao}
    </div>
  );
}
