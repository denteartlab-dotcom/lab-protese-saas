import { readStorage, writeStorage, persistirArmazenamentoImediato } from "@/lib/persisted-storage";

const AUTH_JA_ENTROU_KEY = "labProteseJaEntrou";
const LEMBRAR_LOGIN_KEY = "labProteseLembrarLogin";
const ULTIMO_LAB_LOGIN_KEY = "labProteseUltimoLaboratorio";

export type LembrarLoginSalvo = {
  email: string;
  password?: string;
};

export function salvarLembrarLogin(dados: LembrarLoginSalvo) {
  if (typeof window === "undefined") return;
  const email = dados.email.trim();
  writeStorage(LEMBRAR_LOGIN_KEY, { email });
  void persistirArmazenamentoImediato(LEMBRAR_LOGIN_KEY, { email });
}

export function limparLembrarLogin() {
  if (typeof window === "undefined") return;
  writeStorage(LEMBRAR_LOGIN_KEY, null);
  void persistirArmazenamentoImediato(LEMBRAR_LOGIN_KEY, null);
}

export function lerLembrarLogin(): LembrarLoginSalvo | null {
  if (typeof window === "undefined") return null;
  const parsed = readStorage<{ email?: string } | null>(LEMBRAR_LOGIN_KEY, null);
  if (!parsed?.email?.trim()) return null;
  return { email: parsed.email.trim() };
}

export function marcarUsuarioJaEntrou() {
  if (typeof window === "undefined") return;
  writeStorage(AUTH_JA_ENTROU_KEY, true);
  void persistirArmazenamentoImediato(AUTH_JA_ENTROU_KEY, true);
  gravarCookieJaEntrou();
}

export function usuarioJaEntrou(): boolean {
  if (typeof window === "undefined") return false;
  if (leuCookieJaEntrou()) return true;
  return readStorage<boolean>(AUTH_JA_ENTROU_KEY, false) === true;
}

export const ULTIMO_LAB_SLUG_COOKIE = "lab-protese-ultimo-slug";
export const JA_ENTROU_COOKIE = "lab-protese-ja-entrou";

function gravarCookieJaEntrou() {
  if (typeof document === "undefined") return;
  document.cookie = `${JA_ENTROU_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
}

function leuCookieJaEntrou(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").some((parte) => parte === `${JA_ENTROU_COOKIE}=1`);
}

export type UltimoLaboratorioLogin = {
  slug: string;
  nome: string;
};

function gravarCookieUltimoLabSlug(slug: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${ULTIMO_LAB_SLUG_COOKIE}=${encodeURIComponent(slug)}; path=/; max-age=31536000; samesite=lax`;
}

export function salvarUltimoLaboratorioLogin(dados: UltimoLaboratorioLogin) {
  if (typeof window === "undefined") return;
  const slug = dados.slug?.trim();
  const nome = dados.nome?.trim();
  if (!slug || !nome) return;
  writeStorage(ULTIMO_LAB_LOGIN_KEY, { slug, nome });
  void persistirArmazenamentoImediato(ULTIMO_LAB_LOGIN_KEY, { slug, nome });
  gravarCookieUltimoLabSlug(slug);
}

export function lerUltimoLaboratorioLogin(): UltimoLaboratorioLogin | null {
  if (typeof window === "undefined") return null;
  const parsed = readStorage<Partial<UltimoLaboratorioLogin> | null>(ULTIMO_LAB_LOGIN_KEY, null);
  const slug = parsed?.slug?.trim();
  const nome = parsed?.nome?.trim();
  if (!slug || !nome) return null;
  return { slug, nome };
}

export function rotuloPapelUsuario(role: string): string {
  if (role === "admin" || role === "proprietario" || role === "admin_empresa") {
    return "Proprietário";
  }
  if (role === "gerente") return "Gerente";
  if (role === "financeiro") return "Financeiro";
  if (role === "producao") return "Produção";
  if (role === "usuario") return "Usuário";
  return role;
}
