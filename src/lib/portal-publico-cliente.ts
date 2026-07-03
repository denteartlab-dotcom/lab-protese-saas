import type { PortalPublicoPagina, TipoPortalPublico } from "@/lib/portal-publico-types";

export type ResultadoFetchPortalPublico<T extends PortalPublicoPagina = PortalPublicoPagina> =
  | { ok: true; dados: T }
  | { ok: false; status: number; error: string; message?: string; code?: string };

export async function fetchPortalPublico<T extends PortalPublicoPagina>(
  tipo: TipoPortalPublico,
  token: string,
  opts?: { cache?: RequestCache }
): Promise<ResultadoFetchPortalPublico<T>> {
  const limpo = token.trim();
  if (!limpo) {
    return { ok: false, status: 404, error: "Token inválido." };
  }

  const params = new URLSearchParams({ tipo, token: limpo });

  try {
    const res = await fetch(`/api/public/pagina?${params}`, {
      cache: opts?.cache ?? "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as T & {
      error?: string;
      message?: string;
      code?: string;
    };

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: json.error || json.message || "Não foi possível carregar a página.",
        message: json.message,
        code: json.code,
      };
    }

    return { ok: true, dados: json as T };
  } catch {
    return { ok: false, status: 500, error: "Não foi possível carregar a página." };
  }
}

export function pdfBlobUrlFromBase64(base64: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
}
