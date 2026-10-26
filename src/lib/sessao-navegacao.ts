/**
 * Distingue um carregamento completo (F5, abrir a URL) de uma navegação
 * interna do Next (RSC, prefetch, server action). Essa navegação interna,
 * se receber um redirect para /login, deixa a tela aberta travada.
 */
export function requisicaoEhDocumento(headers: { get(nome: string): string | null }): boolean {
  if (headers.get("rsc") === "1") return false;
  if (headers.get("next-router-prefetch") === "1") return false;
  if (headers.get("next-router-segment-prefetch")) return false;
  if (headers.get("next-action")) return false;
  const destino = headers.get("sec-fetch-dest");
  if (destino && destino !== "document" && destino !== "iframe") return false;
  return true;
}

export function caminhoDeUrl(url: string, origem: string): string {
  try {
    return new URL(url, origem).pathname;
  } catch {
    return "";
  }
}

/** 401 de senha errada no formulário de login não deve mandar de volta para o login. */
export function pedidoPodeRedirecionarSessao(caminho: string): boolean {
  if (!caminho) return false;
  if (caminho === "/api/auth/login" || caminho.startsWith("/api/auth/login/")) return false;
  if (caminho.startsWith("/api/auth/mfa")) return false;
  // Falha ao renovar não pode recarregar a página: o cookie ainda vale e o
  // login devolveria o usuário para o app, piscando sem parar.
  if (caminho === "/api/auth/renovar-sessao") return false;
  if (caminho === "/api/admin-master/auth/login" || caminho.startsWith("/api/admin-master/auth/mfa")) {
    return false;
  }
  return true;
}

export function paginaIgnoraInatividade(caminho: string) {
  return (
    caminho === "/login" ||
    caminho.startsWith("/login/") ||
    caminho.startsWith("/admin-master/login") ||
    caminho === "/limpar-sessao"
  );
}

/**
 * O relógio local da sessão anterior não pode expulsar um login novo.
 * Só sai se o servidor também disser que não há sessão.
 */
export function deveEncerrarPorInatividadeLocal(
  localExpirada: boolean,
  servidorAutenticado: boolean
) {
  if (!localExpirada) return false;
  return !servidorAutenticado;
}

export function respostaIndicaSessaoExpirada(opcoes: {
  status: number;
  redirected: boolean;
  urlFinal: string;
  urlPedido: string;
  origem: string;
}): boolean {
  const pedido = caminhoDeUrl(opcoes.urlPedido, opcoes.origem);
  if (!pedidoPodeRedirecionarSessao(pedido)) return false;
  if (opcoes.status === 401) return true;
  if (!opcoes.redirected) return false;
  const final = caminhoDeUrl(opcoes.urlFinal, opcoes.origem);
  return final === "/login" || final.startsWith("/admin-master/login");
}
