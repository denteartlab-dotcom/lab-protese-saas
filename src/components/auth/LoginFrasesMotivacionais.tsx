"use client";

import { useEffect, useState } from "react";

/** Frases sobre gestão laboratorial + motivacionais (rotacionam no login). */
export const LOGIN_FRASES_LAB = [
  "Organização transformada em sorrisos — um OS de cada vez.",
  "Gestão clara: menos atraso, mais entrega no prazo.",
  "Seu laboratório mais inteligente começa pelo fluxo certo.",
  "Controle de etapas: precisão que o paciente também sente.",
  "IA a favor do lab — foco no que importa: qualidade.",
  "Cada etapa bem gerida é um sorriso entregue no tempo.",
  "Produtividade sem correria: planejar é o melhor acabamento.",
  "Dados no painel, tranquilidade na bancada.",
  "O melhor laboratório é o que enxerga o trabalho inteiro.",
  "Motivação em equipe: juntos, cada prova sai melhor.",
  "Pequenos ajustes no processo, grandes resultados na entrega.",
  "Hoje é um ótimo dia para deixar o lab um passo à frente.",
  "Gestão laboratorial com clareza: do pedido ao sorriso final.",
  "Quando o fluxo flui, a qualidade aparece.",
  "Disciplina nas etapas, excelência no resultado.",
  "Seu painel, seu ritmo — produção sob controle.",
  "Tecnologia a serviço do ofício: o lab ganha tempo e precisão.",
  "Cada OS bem acompanhada fortalece a reputação do laboratório.",
  "Motivação diária: progresso constante, excelência constante.",
  "Gerenciar bem é cuidar de cada detalhe — e de cada prazo.",
] as const;

function escolherFrase(anterior?: string) {
  if (LOGIN_FRASES_LAB.length === 0) return "";
  if (LOGIN_FRASES_LAB.length === 1) return LOGIN_FRASES_LAB[0]!;
  let frase = LOGIN_FRASES_LAB[Math.floor(Math.random() * LOGIN_FRASES_LAB.length)]!;
  let tentativas = 0;
  while (frase === anterior && tentativas < 8) {
    frase = LOGIN_FRASES_LAB[Math.floor(Math.random() * LOGIN_FRASES_LAB.length)]!;
    tentativas += 1;
  }
  return frase;
}

/**
 * Frase aleatória abaixo da ilustração do login, trocando a cada alguns segundos.
 */
export function LoginFrasesMotivacionais({
  className = "",
  intervaloMs = 7000,
}: {
  className?: string;
  intervaloMs?: number;
}) {
  const [frase, setFrase] = useState(() => LOGIN_FRASES_LAB[0]!);
  const [visivel, setVisivel] = useState(true);

  useEffect(() => {
    setFrase(escolherFrase());
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setVisivel(false);
      window.setTimeout(() => {
        setFrase((atual) => escolherFrase(atual));
        setVisivel(true);
      }, 320);
    }, intervaloMs);
    return () => window.clearInterval(id);
  }, [intervaloMs]);

  return (
    <p
      className={`min-h-[3rem] max-w-md text-center text-[13px] font-medium leading-relaxed text-blue-700/80 transition-all duration-300 ${
        visivel ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
      } ${className}`}
      aria-live="polite"
    >
      {frase}
    </p>
  );
}
