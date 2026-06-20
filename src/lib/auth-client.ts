import {
  persistirArmazenamentoImediato,
  readStorage,
  writeStorage,
} from "@/lib/persisted-storage";

const AUTH_JA_ENTROU_KEY = "labProteseJaEntrou";
/** Legado no JsonStore — não usar para credenciais (era global e sobrescrevia contas). */
const LEMBRAR_LOGIN_KEY = "labProteseLembrarLogin";
/** Credenciais lembradas ficam só neste navegador (localStorage). */
const LEMBRAR_LOGIN_LOCAL_KEY = "denteartLoginLembrete";
const PWD_PREFIX = "b64:";

export type LembrarLoginSalvo = {
  email: string;
  password?: string;
};

type LembrarLoginArmazenado = {
  email: string;
  password?: string;
  v?: number;
};

function codificarSenhaLembrete(senha: string): string {
  return PWD_PREFIX + btoa(unescape(encodeURIComponent(senha)));
}

function decodificarSenhaLembrete(codificado?: string): string {
  if (!codificado?.startsWith(PWD_PREFIX)) return "";
  try {
    return decodeURIComponent(escape(atob(codificado.slice(PWD_PREFIX.length))));
  } catch {
    return "";
  }
}

function lerLembreteLocalStorage(): LembrarLoginSalvo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LEMBRAR_LOGIN_LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LembrarLoginArmazenado;
    const email = parsed.email?.trim();
    if (!email) return null;
    const password = decodificarSenhaLembrete(parsed.password);
    return password ? { email, password } : { email };
  } catch {
    return null;
  }
}

function gravarLembreteLocalStorage(dados: LembrarLoginSalvo) {
  if (typeof window === "undefined") return;
  const email = dados.email.trim();
  if (!email) return;
  const payload: LembrarLoginArmazenado = {
    email,
    v: 1,
  };
  const senha = dados.password ?? "";
  if (senha) {
    payload.password = codificarSenhaLembrete(senha);
  }
  window.localStorage.setItem(LEMBRAR_LOGIN_LOCAL_KEY, JSON.stringify(payload));
}

function limparLembreteLocalStorage() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LEMBRAR_LOGIN_LOCAL_KEY);
  } catch {
    /* ignore */
  }
}

/** Remove credenciais legadas do JsonStore global (comportamento antigo). */
function limparLembreteLegadoServidor() {
  if (typeof window === "undefined") return;
  writeStorage(LEMBRAR_LOGIN_KEY, null);
  void persistirArmazenamentoImediato(LEMBRAR_LOGIN_KEY, null);
}

function migrarLembreteLegado(): LembrarLoginSalvo | null {
  const legado = readStorage<{ email?: string } | null>(LEMBRAR_LOGIN_KEY, null);
  const email = legado?.email?.trim();
  if (!email) return null;
  const dados = { email };
  gravarLembreteLocalStorage(dados);
  limparLembreteLegadoServidor();
  return dados;
}

export function salvarLembrarLogin(dados: LembrarLoginSalvo) {
  if (typeof window === "undefined") return;
  gravarLembreteLocalStorage(dados);
  limparLembreteLegadoServidor();
}

export function limparLembrarLogin() {
  if (typeof window === "undefined") return;
  limparLembreteLocalStorage();
  limparLembreteLegadoServidor();
}

export function lerLembrarLogin(): LembrarLoginSalvo | null {
  if (typeof window === "undefined") return null;
  return lerLembreteLocalStorage() ?? migrarLembreteLegado();
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
  writeStorage("labProteseUltimoLaboratorio", { slug, nome });
  void persistirArmazenamentoImediato("labProteseUltimoLaboratorio", { slug, nome });
  gravarCookieUltimoLabSlug(slug);
}

export function lerUltimoLaboratorioLogin(): UltimoLaboratorioLogin | null {
  if (typeof window === "undefined") return null;
  const parsed = readStorage<Partial<UltimoLaboratorioLogin> | null>(
    "labProteseUltimoLaboratorio",
    null
  );
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
