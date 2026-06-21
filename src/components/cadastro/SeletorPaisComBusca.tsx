"use client";

import { ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { PAISES_TELEFONE, type PaisTelefone } from "@/lib/paises-telefone";
import { cn } from "@/lib/utils";

type Modo = "pais" | "telefone";

type Props = {
  modo: Modo;
  value: string;
  onChange: (value: string, pais?: PaisTelefone) => void;
  /** ISO do país selecionado — ajuda a exibir a bandeira correta quando o DDI se repete (+1, +7…). */
  paisIso?: string;
  className?: string;
  id?: string;
  "aria-label"?: string;
};

function normalizarBusca(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function resolverPais(modo: Modo, value: string, paisIso?: string) {
  if (modo === "pais") {
    return PAISES_TELEFONE.find((p) => p.iso === value);
  }
  if (paisIso) {
    const porIso = PAISES_TELEFONE.find((p) => p.iso === paisIso);
    if (porIso?.dial === value) return porIso;
  }
  return PAISES_TELEFONE.find((p) => p.dial === value);
}

function rotuloSelecionado(modo: Modo, value: string, paisIso?: string) {
  const pais = resolverPais(modo, value, paisIso);
  if (!pais) {
    return modo === "pais" ? (
      <span className="text-lg leading-none text-slate-400" aria-hidden>
        🏳️
      </span>
    ) : (
      "+?"
    );
  }

  if (modo === "pais") {
    return (
      <span className="text-xl leading-none" aria-label={pais.nome} title={pais.nome}>
        {pais.bandeira}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5 truncate" title={`${pais.nome} ${pais.dial}`}>
      <span className="text-base leading-none" aria-hidden>
        {pais.bandeira}
      </span>
      <span className="truncate text-xs font-medium">{pais.dial}</span>
    </span>
  );
}

export function SeletorPaisComBusca({
  modo,
  value,
  onChange,
  paisIso,
  className,
  id,
  "aria-label": ariaLabel,
}: Props) {
  const listaId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");

  const opcoes = useMemo(() => {
    const termo = normalizarBusca(busca);
    if (!termo) return PAISES_TELEFONE;
    return PAISES_TELEFONE.filter((pais) => {
      const alvo = normalizarBusca(
        `${pais.nome} ${pais.iso} ${pais.dial.replace("+", "")}`
      );
      return alvo.includes(termo);
    });
  }, [busca]);

  useEffect(() => {
    if (!aberto) return;
    const timer = window.setTimeout(() => buscaRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [aberto]);

  useEffect(() => {
    function fechar(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setAberto(false);
        setBusca("");
      }
    }
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, []);

  function selecionar(pais: PaisTelefone) {
    onChange(modo === "pais" ? pais.iso : pais.dial, pais);
    setAberto(false);
    setBusca("");
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={listaId}
        onClick={() => setAberto((v) => !v)}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-left text-sm text-slate-800 outline-none transition hover:border-slate-300 focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/15",
          modo === "pais" && "justify-center px-2",
          modo === "telefone" && "min-w-[96px]"
        )}
      >
        <span className={cn("min-w-0 flex-1", modo === "pais" && "flex justify-center")}>
          {rotuloSelecionado(modo, value, paisIso)}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition", aberto && "rotate-180")} />
      </button>

      {aberto ? (
        <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                ref={buscaRef}
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={modo === "pais" ? "Buscar país..." : "Buscar código..."}
                className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-2 text-xs outline-none focus:border-[#0066FF] focus:bg-white"
              />
            </div>
          </div>
          <ul
            id={listaId}
            role="listbox"
            className="max-h-52 overflow-y-auto py-1"
          >
            {opcoes.length === 0 ? (
              <li className="px-3 py-2 text-xs text-slate-500">Nenhum resultado.</li>
            ) : (
              opcoes.map((pais) => {
                const selecionado =
                  modo === "pais" ? pais.iso === value : pais.dial === value;
                return (
                  <li key={`${pais.iso}-${pais.dial}`} role="option" aria-selected={selecionado}>
                    <button
                      type="button"
                      onClick={() => selecionar(pais)}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-slate-50",
                        selecionado && "bg-blue-50 text-[#0066FF]"
                      )}
                    >
                      <span className="text-base leading-none" aria-hidden>
                        {pais.bandeira}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{pais.nome}</span>
                      {modo === "telefone" ? (
                        <span className="shrink-0 font-medium text-slate-600">{pais.dial}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
