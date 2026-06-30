"use client";

import { useEffect } from "react";
import {
  liberarPresencaSocket,
  referenciarPresencaSocket,
} from "@/lib/presenca-socket-singleton";

/** Registra o usuário como online enquanto navega no app (painel TV). */
export function usePresencaApp(ativo = true) {
  useEffect(() => {
    if (!ativo) return;
    referenciarPresencaSocket();
    return () => liberarPresencaSocket();
  }, [ativo]);
}
