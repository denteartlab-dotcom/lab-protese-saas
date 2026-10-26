"use client";

import { limparUltimaAtividadeSessao } from "@/lib/sessao-inatividade";
import {
  paginaIgnoraInatividade,
  respostaIndicaSessaoExpirada,
} from "@/lib/sessao-navegacao";

let redirecionando = false;
let instalado = false;
let servidorMorto = false;

/** Login novo confirmado: o clique deixa de ser tratado como sessão morta. */
export function confirmarSessaoRenovada() {
  servidorMorto = false;
  redirecionando = false;
}

export function irParaLogin() {
  if (typeof window === "undefined" || redirecionando) return;
  const caminho = window.location.pathname;
  if (paginaIgnoraInatividade(caminho)) return;
  redirecionando = true;
  servidorMorto = true;
  limparUltimaAtividadeSessao();
  const destino = caminho.startsWith("/admin-master") ? "/admin-master/login" : "/login";
  // Não chama /api/auth/logout aqui: a resposta pode chegar depois do novo
  // login e apagar o cookie da sessão que acabou de entrar.
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
    if (paginaIgnoraInatividade(window.location.pathname)) return;
    if (!servidorMorto) return;
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
      !paginaIgnoraInatividade(window.location.pathname)
    ) {
      irParaLogin();
    }
    return resposta;
  }) as typeof window.fetch;
}
