"use client";

import { sessaoExpiradaPorInatividade, limparUltimaAtividadeSessao } from "@/lib/sessao-inatividade";
import { respostaIndicaSessaoExpirada } from "@/lib/sessao-navegacao";

let redirecionando = false;
let instalado = false;

function paginaDeLogin(caminho: string) {
  return caminho === "/login" || caminho.startsWith("/login/") || caminho.startsWith("/admin-master/login");
}

export function irParaLogin() {
  if (typeof window === "undefined" || redirecionando) return;
  const caminho = window.location.pathname;
  if (paginaDeLogin(caminho) || caminho === "/limpar-sessao") return;
  redirecionando = true;
  limparUltimaAtividadeSessao();
  const destino = caminho.startsWith("/admin-master") ? "/admin-master/login" : "/login";
  void fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => undefined);
  window.location.replace(destino);
}

function urlDoPedido(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (typeof Request !== "undefined" && input instanceof Request) return input.url;
  return "";
}

/** Qualquer clique ou resposta 401 manda para o login em vez de deixar o app aberto travado. */
export function instalarRedirecionamentoSessaoExpirada() {
  if (typeof window === "undefined" || instalado) return;
  instalado = true;

  const aoInteragir = (evento: Event) => {
    if (!sessaoExpiradaPorInatividade()) return;
    evento.preventDefault();
    evento.stopPropagation();
    irParaLogin();
  };
  document.addEventListener("pointerdown", aoInteragir, true);
  document.addEventListener("click", aoInteragir, true);
  document.addEventListener("keydown", aoInteragir, true);

  const fetchOriginal = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const resposta = await fetchOriginal(input, init);
    const pedido = urlDoPedido(input);
    if (
      respostaIndicaSessaoExpirada({
        status: resposta.status,
        redirected: resposta.redirected,
        urlFinal: resposta.url,
        urlPedido: pedido || resposta.url,
        origem: window.location.origin,
      }) &&
      !paginaDeLogin(window.location.pathname)
    ) {
      irParaLogin();
    }
    return resposta;
  }) as typeof window.fetch;
}
