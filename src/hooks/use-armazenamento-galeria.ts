"use client";

import { useCallback, useEffect, useState } from "react";
import {
  MENSAGEM_LIMITE_GALERIA_ESGOTADO,
  UPLOADS_ATUALIZADO_EVENT,
  armazenamentoGaleriaCabeArquivos,
  armazenamentoGaleriaEsgotado,
  somaBytesArquivos,
  type UploadsResumoArmazenamento,
} from "@/lib/uploads-armazenamento";

export function useArmazenamentoGaleria() {
  const [resumo, setResumo] = useState<UploadsResumoArmazenamento | null>(null);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    try {
      const res = await fetch("/api/uploads", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (res.ok) {
        setResumo((await res.json()) as UploadsResumoArmazenamento);
      }
    } catch {
      /* mantém último valor */
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
    const onAtualizado = () => void recarregar();
    window.addEventListener(UPLOADS_ATUALIZADO_EVENT, onAtualizado);
    return () => window.removeEventListener(UPLOADS_ATUALIZADO_EVENT, onAtualizado);
  }, [recarregar]);

  const esgotado = resumo ? armazenamentoGaleriaEsgotado(resumo.bytesLivres) : false;

  function podeEnviarArquivos(arquivos: Iterable<File>): boolean {
    if (!resumo) return true;
    return armazenamentoGaleriaCabeArquivos(
      resumo.bytesLivres,
      somaBytesArquivos(arquivos)
    );
  }

  function mensagemBloqueioUpload(): string | null {
    if (!resumo || !esgotado) return null;
    return MENSAGEM_LIMITE_GALERIA_ESGOTADO;
  }

  return {
    resumo,
    carregando,
    esgotado,
    recarregar,
    podeEnviarArquivos,
    mensagemBloqueioUpload,
  };
}
