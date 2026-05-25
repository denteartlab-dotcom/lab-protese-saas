const AUTH_JA_ENTROU_KEY = "labProteseJaEntrou";

export function marcarUsuarioJaEntrou() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_JA_ENTROU_KEY, "1");
}

export function usuarioJaEntrou(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(AUTH_JA_ENTROU_KEY) === "1";
}

export function rotuloPapelUsuario(role: string): string {
  if (role === "admin") return "Administrador";
  return role;
}
