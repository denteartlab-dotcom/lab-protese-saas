import {
  persistirArmazenamentoImediato,
  readStorage,
  writeStorage,
} from "@/lib/persisted-storage";

const AUTH_JA_ENTROU_KEY = "labProteseJaEntrou";
/** Legado no JsonStore — não usar para credenciais (era global e sobrescrevia contas). */
const LEMBRAR_LOGIN_KEY = "labProteseLembrarLogin";
/** E-mail lembrado neste navegador (localStorage). Senha NÃO é armazenada. */
const LEMBRAR_LOGIN_LOCAL_KEY = "denteartLoginLembrete";

export type LembrarLoginSalvo = {
  email: string;
};

type LembrarLoginArmazenado = {
  email: string;
  /** @deprecated nunca gravar senha — campo legado removido na leitura */
  password?: string;
  v?: number;
};

function lerLembreteLocalStorage(): LembrarLoginSalvo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LEMBRAR_LOGIN_LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LembrarLoginArmazenado;
    const email = parsed.email?.trim();
    if (!email) return null;
    // Migra v3 (com senha ofuscada) → só e-mail
    if (parsed.password || parsed.v === 3) {
      gravarLembreteLocalStorage({ email });
    }
    return { email };
  } catch {
    return null;
  }
}

function gravarLembreteLocalStorage(dados: LembrarLoginSalvo) {
  if (typeof window === "undefined") return;
  const email = dados.email.trim();
  if (!email) return;
  const payload: LembrarLoginArmazenado = { email, v: 4 };
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
  const legado = readStorage<{ email?: string; password?: string } | null>(
    LEMBRAR_LOGIN_KEY,
    null
  );
  const email = legado?.email?.trim();
  if (!email) return null;
  const dados: LembrarLoginSalvo = { email };
  gravarLembreteLocalStorage(dados);
  limparLembreteLegadoServidor();
  return dados;
}

/** Salva apenas o e-mail. A senha fica no cookie de sessão (remember) / gerenciador do navegador. */
export function salvarLembrarLogin(dados: LembrarLoginSalvo) {
  if (typeof window === "undefined") return;
  gravarLembreteLocalStorage({ email: dados.email });
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

const LOGO_LAB_LOGIN_CACHE = "denteartLabLogoPorSlug";

function lerMapaLogoLogin(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LOGO_LAB_LOGIN_CACHE);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    const map: Record<string, string> = {};
    for (const [slug, logo] of Object.entries(parsed)) {
      if (typeof logo === "string" && logo.trim()) {
        map[slug.toLowerCase()] = logo.trim();
      }
    }
    return map;
  } catch {
    return {};
  }
}

/** Cache local do logo por slug — fallback no login quando o SSR ainda não tem a imagem. */
export function salvarLogoLaboratorioLogin(slug: string, logoDataUrl: string) {
  if (typeof window === "undefined") return;
  const chave = slug.trim().toLowerCase();
  const logo = logoDataUrl.trim();
  if (!chave || !logo.startsWith("data:image")) return;
  try {
    const map = lerMapaLogoLogin();
    map[chave] = logo;
    window.localStorage.setItem(LOGO_LAB_LOGIN_CACHE, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function lerLogoLaboratorioLogin(slug: string): string {
  if (typeof window === "undefined") return "";
  const chave = slug.trim().toLowerCase();
  if (!chave) return "";
  return lerMapaLogoLogin()[chave] || "";
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
