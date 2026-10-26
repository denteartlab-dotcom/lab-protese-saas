"use client";

import { Modal } from "@/components/ui";
import type { ReactNode } from "react";

type Props = {
  aberto: boolean;
  titulo: string;
  onFechar: () => void;
  children: ReactNode;
  largura?: "md" | "lg" | "xl";
};

/** Formulário de cadastro na lateral, com a listagem visível atrás. */
export function CadastroPainelLateral({
  aberto,
  titulo,
  onFechar,
  children,
  largura = "xl",
}: Props) {
  return (
    <Modal open={aberto} onClose={onFechar} title={titulo} size={largura} ancora="lateral">
      {children}
    </Modal>
  );
}
