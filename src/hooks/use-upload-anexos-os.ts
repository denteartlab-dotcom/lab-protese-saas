"use client";

import { useCallback, useRef, useState } from "react";
import type { AnexoOs } from "@/lib/os-anexos";
import { excluirUploadPorUrl } from "@/lib/uploads-armazenamento";
import {
  chaveArquivoOs,
  enviarArquivosOs,
} from "@/lib/upload-anexos-os-cliente";

type EnvioPendente = {
  promise: Promise<AnexoOs[]>;
  abort: AbortController;
  chaves: string[];
};

export function useUploadAnexosOs(onConcluido?: (anexos: AnexoOs[]) => void) {
  const [pendentes, setPendentes] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const enviosRef = useRef(new Map<string, EnvioPendente>());
  const canceladosRef = useRef(new Set<string>());
  const concluidosRef = useRef<AnexoOs[]>([]);
  const pendentesRef = useRef<File[]>([]);
  const onConcluidoRef = useRef(onConcluido);
  onConcluidoRef.current = onConcluido;
  pendentesRef.current = pendentes;

  const iniciarUpload = useCallback((novos: File[]) => {
    if (!novos.length) return;
    const abort = new AbortController();
    const chaves = novos.map(chaveArquivoOs);
    const id = chaves.join("|") + String(Date.now());
    const promise = enviarArquivosOs(novos, abort.signal)
      .then((enviados) => {
        const aproveitar: AnexoOs[] = [];
        enviados.forEach((anexo, index) => {
          const arquivo = novos[index];
          const chave = arquivo ? chaveArquivoOs(arquivo) : chaves[index] || "";
          if (chave && canceladosRef.current.has(chave)) {
            void excluirUploadPorUrl(anexo.url);
            return;
          }
          aproveitar.push(anexo);
        });
        concluidosRef.current = [...concluidosRef.current, ...aproveitar];
        if (aproveitar.length) onConcluidoRef.current?.(aproveitar);
        setPendentes((atuais) =>
          atuais.filter((arquivo) => !chaves.includes(chaveArquivoOs(arquivo)))
        );
        return aproveitar;
      })
      .catch((err) => {
        if (abort.signal.aborted) return [];
        setPendentes((atuais) =>
          atuais.filter((arquivo) => !chaves.includes(chaveArquivoOs(arquivo)))
        );
        throw err;
      })
      .finally(() => {
        enviosRef.current.delete(id);
        if (enviosRef.current.size === 0) setEnviando(false);
      });

    enviosRef.current.set(id, { promise, abort, chaves });
    setEnviando(true);
  }, []);

  const adicionar = useCallback(
    (novos: File[]) => {
      if (!novos.length) return;
      for (const arquivo of novos) {
        canceladosRef.current.delete(chaveArquivoOs(arquivo));
      }
      setPendentes((atuais) => [...atuais, ...novos]);
      iniciarUpload(novos);
    },
    [iniciarUpload]
  );

  const definirPendentes = useCallback(
    (proxima: File[]) => {
      const atuais = pendentesRef.current;
      const atuaisKeys = new Set(atuais.map(chaveArquivoOs));
      const nextKeys = new Set(proxima.map(chaveArquivoOs));
      for (const arquivo of atuais) {
        const chave = chaveArquivoOs(arquivo);
        if (!nextKeys.has(chave)) canceladosRef.current.add(chave);
      }
      const novos = proxima.filter((arquivo) => !atuaisKeys.has(chaveArquivoOs(arquivo)));
      setPendentes(proxima);
      if (novos.length) iniciarUpload(novos);
    },
    [iniciarUpload]
  );

  const removerIndice = useCallback((index: number) => {
    setPendentes((atuais) => {
      const alvo = atuais[index];
      if (alvo) canceladosRef.current.add(chaveArquivoOs(alvo));
      return atuais.filter((_, i) => i !== index);
    });
  }, []);

  const limpar = useCallback(() => {
    for (const arquivo of pendentesRef.current) {
      canceladosRef.current.add(chaveArquivoOs(arquivo));
    }
    concluidosRef.current = [];
    setPendentes([]);
  }, []);

  const aguardar = useCallback(async (): Promise<AnexoOs[]> => {
    const pendentesAgora = [...enviosRef.current.values()];
    if (pendentesAgora.length === 0) return concluidosRef.current;
    const resultados = await Promise.allSettled(
      pendentesAgora.map((item) => item.promise)
    );
    const falha = resultados.find(
      (item): item is PromiseRejectedResult => item.status === "rejected"
    );
    if (falha) throw falha.reason;
    return concluidosRef.current;
  }, []);

  const consumirConcluidos = useCallback(() => {
    const lista = concluidosRef.current;
    concluidosRef.current = [];
    return lista;
  }, []);

  return {
    pendentes,
    enviando,
    adicionar,
    definirPendentes,
    removerIndice,
    limpar,
    aguardar,
    consumirConcluidos,
  };
}
