"use client";

import { useEffect } from "react";

const SELETOR_EDITAVEL =
  'input, textarea, select, [contenteditable="true"], [contenteditable=""], .allow-text-select';

/**
 * Impede o caret "|" e a seleção de texto na UI.
 * Mantém seleção apenas em campos onde digitar/copiar é necessário.
 */
export function DesativarSelecaoTexto() {
  useEffect(() => {
    const editavel = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      return Boolean(target.closest(SELETOR_EDITAVEL));
    };

    const onSelectStart = (e: Event) => {
      if (!editavel(e.target)) e.preventDefault();
    };

    const onDragStart = (e: DragEvent) => {
      if (!editavel(e.target)) e.preventDefault();
    };

    document.addEventListener("selectstart", onSelectStart, { capture: true });
    document.addEventListener("dragstart", onDragStart, { capture: true });
    return () => {
      document.removeEventListener("selectstart", onSelectStart, { capture: true });
      document.removeEventListener("dragstart", onDragStart, { capture: true });
    };
  }, []);

  return null;
}
