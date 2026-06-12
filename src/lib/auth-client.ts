import { readStorage, writeStorage } from "@/lib/persisted-storage";

const AUTH_JA_ENTROU_KEY = "labProteseJaEntrou";
const LEMBRAR_LOGIN_KEY = "labProteseLembrarLogin";
/** Senha lembrada só no navegador (não sincroniza com o banco). */
const LEMBRAR_SENHA_LOCAL_KEY = "labProteseLembrarLoginSenha";

export type LembrarLoginSalvo = {
  email: string;
  password?: string;
};

function lerSenhaLembradaLocal(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const senha = window.localStorage.getItem(LEMBRAR_SENHA_LOCAL_KEY);
    return senha || undefined;
  } catch {
    return undefined;
  }
}

function gravarSenhaLembradaLocal(senha?: string) {
  if (typeof window === "undefined") return;
  try {
    if (senha) {
      window.localStorage.setItem(LEMBRAR_SENHA_LOCAL_KEY, senha);
    } else {
      window.localStorage.removeItem(LEMBRAR_SENHA_LOCAL_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function salvarLembrarLogin(dados: LembrarLoginSalvo) {
  if (typeof window === "undefined") return;
  writeStorage(LEMBRAR_LOGIN_KEY, { email: dados.email.trim() });
  gravarSenhaLembradaLocal(dados.password);
}

export function limparLembrarLogin() {
  if (typeof window === "undefined") return;
  writeStorage(LEMBRAR_LOGIN_KEY, null);
  gravarSenhaLembradaLocal();
}

export function lerLembrarLogin(): LembrarLoginSalvo | null {
  if (typeof window === "undefined") return null;
  const parsed = readStorage<{ email?: string } | null>(LEMBRAR_LOGIN_KEY, null);
  if (!parsed?.email?.trim()) return null;
  const password = lerSenhaLembradaLocal();
  return { email: parsed.email.trim(), password };
}

export function marcarUsuarioJaEntrou() {
  if (typeof window === "undefined") return;
  writeStorage(AUTH_JA_ENTROU_KEY, true);
}

export function usuarioJaEntrou(): boolean {
  if (typeof window === "undefined") return false;
  return readStorage<boolean>(AUTH_JA_ENTROU_KEY, false) === true;
}

export function rotuloPapelUsuario(role: string): string {
  if (role === "admin" || role === "proprietario") return "Proprietário";
  if (role === "gerente") return "Gerente";
  if (role === "financeiro") return "Financeiro";
  if (role === "producao") return "Produção";
  if (role === "usuario") return "Usuário";
  return role;
}
