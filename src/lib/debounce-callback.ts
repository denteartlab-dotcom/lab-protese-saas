/** Retorna função debounced e a função para cancelar o timer pendente. */
export function debounceCallback(fn: () => void, delayMs: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn();
    }, delayMs);
  };
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return { debounced, cancel };
}
