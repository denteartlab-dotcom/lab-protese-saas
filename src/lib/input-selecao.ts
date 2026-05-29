import type {
  DragEvent,
  FocusEvent,
  InputHTMLAttributes,
  MouseEvent,
} from "react";

/** Impede arrastar texto de um campo e soltar em outro (comportamento nativo do navegador). */
export function propsBloquearArrasteEntreCampos() {
  const bloquear = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  return {
    draggable: false as const,
    onDragStart: bloquear,
    onDrag: bloquear,
    onDragEnd: bloquear,
    onDragOver: bloquear,
    onDrop: bloquear,
  };
}

/** Seleciona todo o texto do campo (permite apagar com Backspace/Delete de uma vez). */
export function selecionarTextoInput(
  elemento: HTMLInputElement | HTMLTextAreaElement
) {
  requestAnimationFrame(() => elemento.select());
}

export function criarHandlersSelecionarAoFocar<
  T extends HTMLInputElement | HTMLTextAreaElement = HTMLInputElement,
>(onFocus?: (e: FocusEvent<T>) => void, onClick?: (e: MouseEvent<T>) => void) {
  return {
    onFocus: (e: FocusEvent<T>) => {
      selecionarTextoInput(e.currentTarget);
      onFocus?.(e);
    },
    onClick: (e: MouseEvent<T>) => {
      if (document.activeElement === e.currentTarget) {
        selecionarTextoInput(e.currentTarget);
      }
      onClick?.(e);
    },
  };
}

/** Mescla handlers de seleção ao focar em props de `<input>`. */
export function propsInputComSelecaoAoFocar<P extends InputHTMLAttributes<HTMLInputElement>>(
  props: P
): P {
  const { onFocus, onClick, ...rest } = props;
  return {
    ...rest,
    ...criarHandlersSelecionarAoFocar(onFocus, onClick),
  } as P;
}
