"use client";

import { useEffect, useMemo, useState } from "react";
import {
  gravarConfigListagem,
  lerConfigListagem,
  normalizarPorPagina,
  POR_PAGINA_PADRAO,
  type ConfigListagemPersistida,
  type DirecaoLista,
} from "@/lib/listagem-config";

export type OpcaoOrdenacaoLista<C extends string> = {
  valor: C;
  label: string;
};

type UseListagemPaginadaParams<T, C extends string> = {
  storageKey: string;
  itens: T[];
  padrao: ConfigListagemPersistida<C>;
  comparadores: Record<C, (a: T, b: T) => number>;
  filtrarExtras?: (item: T, extras: Record<string, boolean>) => boolean;
};

export function useListagemPaginada<T, C extends string>({
  storageKey,
  itens,
  padrao,
  comparadores,
  filtrarExtras,
}: UseListagemPaginadaParams<T, C>) {
  const padraoCompleto: ConfigListagemPersistida<C> = {
    ...padrao,
    porPagina: padrao.porPagina || POR_PAGINA_PADRAO,
  };

  const [config, setConfig] = useState(padraoCompleto);
  const [rascunho, setRascunho] = useState(padraoCompleto);
  const [configAberto, setConfigAberto] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [configCarregada, setConfigCarregada] = useState(false);

  useEffect(() => {
    const lida = lerConfigListagem(storageKey, padraoCompleto);
    setConfig(lida);
    setRascunho(lida);
    setConfigCarregada(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- padrao estável por storageKey
  }, [storageKey]);

  const itensProcessados = useMemo(() => {
    let lista = itens;
    if (filtrarExtras && config.extras) {
      lista = lista.filter((item) => filtrarExtras(item, config.extras!));
    }
    const comparar = comparadores[config.ordenarPor];
    if (!comparar) return [...lista];
    const ordenada = [...lista].sort(comparar);
    if (config.direcao === "desc") ordenada.reverse();
    return ordenada;
  }, [itens, config, comparadores, filtrarExtras]);

  const totalPaginas = Math.max(1, Math.ceil(itensProcessados.length / config.porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);

  useEffect(() => {
    setPagina(1);
  }, [
    config.porPagina,
    config.ordenarPor,
    config.direcao,
    JSON.stringify(config.extras),
    itens.length,
  ]);

  useEffect(() => {
    if (pagina > totalPaginas) setPagina(totalPaginas);
  }, [pagina, totalPaginas]);

  const itensPagina = useMemo(() => {
    const inicio = (paginaAtual - 1) * config.porPagina;
    return itensProcessados.slice(inicio, inicio + config.porPagina);
  }, [itensProcessados, paginaAtual, config.porPagina]);

  function abrirConfig() {
    setRascunho(config);
    setConfigAberto(true);
  }

  function fecharConfig() {
    setConfigAberto(false);
  }

  function gravarConfig() {
    const nova: ConfigListagemPersistida<C> = {
      ...rascunho,
      porPagina: normalizarPorPagina(rascunho.porPagina),
    };
    setConfig(nova);
    gravarConfigListagem(storageKey, nova);
    setConfigAberto(false);
  }

  function atualizarRascunho(parcial: Partial<ConfigListagemPersistida<C>>) {
    setRascunho((atual) => ({ ...atual, ...parcial }));
  }

  function atualizarExtraRascunho(chave: string, valor: boolean) {
    setRascunho((atual) => ({
      ...atual,
      extras: { ...atual.extras, [chave]: valor },
    }));
  }

  return {
    config,
    configCarregada,
    rascunho,
    atualizarRascunho,
    atualizarExtraRascunho,
    configAberto,
    setConfigAberto,
    abrirConfig,
    fecharConfig,
    gravarConfig,
    itensPagina,
    itensProcessados,
    totalPaginas,
    pagina: paginaAtual,
    setPagina,
    totalItens: itensProcessados.length,
  };
}

export type { ConfigListagemPersistida, DirecaoLista };
