import type {
  FocusEvent,
  InputHTMLAttributes,
  MouseEvent,
} from "react";

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
