const AUTH_JA_ENTROU_KEY = "labProteseJaEntrou";
const LEMBRAR_LOGIN_KEY = "labProteseLembrarLogin";

export type LembrarLoginSalvo = {
  email: string;
  password: string;
};

export function salvarLembrarLogin(dados: LembrarLoginSalvo) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LEMBRAR_LOGIN_KEY, JSON.stringify(dados));
}

export function limparLembrarLogin() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LEMBRAR_LOGIN_KEY);
}

export function lerLembrarLogin(): LembrarLoginSalvo | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(LEMBRAR_LOGIN_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LembrarLoginSalvo;
    if (!parsed.email?.trim() || !parsed.password) return null;
    return { email: parsed.email.trim(), password: parsed.password };
  } catch {
    return null;
  }
}

export function marcarUsuarioJaEntrou() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_JA_ENTROU_KEY, "1");
}

export function usuarioJaEntrou(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(AUTH_JA_ENTROU_KEY) === "1";
}

export function rotuloPapelUsuario(role: string): string {
  if (role === "admin" || role === "proprietario") return "Proprietário";
  if (role === "gerente") return "Gerente";
  if (role === "financeiro") return "Financeiro";
  if (role === "producao") return "Produção";
  if (role === "usuario") return "Usuário";
  return role;
}
