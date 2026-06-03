import { readStorage, writeStorage } from "@/lib/persisted-storage";

const AUTH_JA_ENTROU_KEY = "labProteseJaEntrou";
const LEMBRAR_LOGIN_KEY = "labProteseLembrarLogin";

export type LembrarLoginSalvo = {
  email: string;
};

export function salvarLembrarLogin(dados: LembrarLoginSalvo) {
  if (typeof window === "undefined") return;
  writeStorage(LEMBRAR_LOGIN_KEY, { email: dados.email.trim() });
}

export function limparLembrarLogin() {
  if (typeof window === "undefined") return;
  writeStorage(LEMBRAR_LOGIN_KEY, null);
}

export function lerLembrarLogin(): LembrarLoginSalvo | null {
  if (typeof window === "undefined") return null;
  const parsed = readStorage<LembrarLoginSalvo | null>(LEMBRAR_LOGIN_KEY, null);
  if (!parsed?.email?.trim()) return null;
  return { email: parsed.email.trim() };
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
