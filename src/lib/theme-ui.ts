/** Espelho local do tema para aplicar antes da hidratação (evita flash claro). */
export const THEME_LOCAL_STORAGE_KEY = "labProteseDarkMode";

export function aplicarTemaDocumento(dark: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", dark);
}

export function persistirTemaLocal(dark: boolean) {
  aplicarTemaDocumento(dark);
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(THEME_LOCAL_STORAGE_KEY, dark ? "dark" : "light");
  } catch {
    /* ignore */
  }
}

export function lerTemaLocal(): boolean | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const valor = localStorage.getItem(THEME_LOCAL_STORAGE_KEY);
    if (valor === "dark") return true;
    if (valor === "light") return false;
    return null;
  } catch {
    return null;
  }
}
