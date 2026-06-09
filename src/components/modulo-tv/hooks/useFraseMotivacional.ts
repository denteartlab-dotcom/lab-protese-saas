"use client";

import { useEffect, useRef, useState } from "react";
import { fraseMotivacionalPorIndice } from "@/components/modulo-tv/lib/frases-motivacionais";

/** Avança a frase sempre que `ultimaAtualizacao` muda (ciclo ~28s do painel). */
export function useFraseMotivacional(ultimaAtualizacao: Date) {
  const [indice, setIndice] = useState(0);
  const ultimaTsRef = useRef<number | null>(null);

  useEffect(() => {
    const ts = ultimaAtualizacao.getTime();
    if (ultimaTsRef.current !== null && ts !== ultimaTsRef.current) {
      setIndice((atual) => atual + 1);
    }
    ultimaTsRef.current = ts;
  }, [ultimaAtualizacao]);

  return fraseMotivacionalPorIndice(indice);
}
