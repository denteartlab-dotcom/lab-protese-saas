/**
 * Sessão cai após 2h mesmo com o site fechado (cookie/iat).
 * Uso: npx tsx scripts/testar-sessao-inatividade.ts
 */
import {
  pedidoPodeRedirecionarSessao,
  requisicaoEhDocumento,
  respostaIndicaSessaoExpirada,
} from "../src/lib/sessao-navegacao";
import {
  SESSAO_INATIVIDADE_MS,
  SESSAO_INATIVIDADE_S,
  sessaoInativaPorIat,
  ttlCookieSessaoLabSegundos,
} from "../src/lib/sessao-ttl";

function assert(condicao: boolean, mensagem: string) {
  if (!condicao) throw new Error(mensagem);
}

assert(SESSAO_INATIVIDADE_S === 2 * 60 * 60, "inatividade padrão é 2 horas");
assert(SESSAO_INATIVIDADE_MS === SESSAO_INATIVIDADE_S * 1000, "ms alinhado aos segundos");
assert(
  ttlCookieSessaoLabSegundos(true) === SESSAO_INATIVIDADE_S,
  "lembrar e-mail não deve manter sessão de 7 dias"
);
assert(
  ttlCookieSessaoLabSegundos(false) === SESSAO_INATIVIDADE_S,
  "sessão sem lembrar também dura 2h e desliza com o uso"
);

const agora = Date.now();
assert(!sessaoInativaPorIat(Math.floor(agora / 1000), agora), "iat agora ainda é válido");
assert(
  !sessaoInativaPorIat(Math.floor(agora / 1000) - SESSAO_INATIVIDADE_S + 30, agora),
  "1h59 ainda dentro do limite"
);
assert(
  sessaoInativaPorIat(Math.floor(agora / 1000) - SESSAO_INATIVIDADE_S - 1, agora),
  "após 2h o JWT inativo deve cair mesmo com o site fechado"
);
assert(!sessaoInativaPorIat(undefined, agora), "token legado sem iat não quebra a checagem");
assert(!sessaoInativaPorIat(NaN, agora), "iat inválido não derruba por inatividade");

const cabecalhoDocumento = new Headers({ "sec-fetch-dest": "document" });
const cabecalhoClique = new Headers({
  rsc: "1",
  "next-url": "/app",
  "sec-fetch-dest": "empty",
});
assert(requisicaoEhDocumento(cabecalhoDocumento), "F5 continua sendo navegação de documento");
assert(!requisicaoEhDocumento(cabecalhoClique), "clique interno não pode receber redirect de login");
assert(
  !requisicaoEhDocumento(new Headers({ "next-router-prefetch": "1" })),
  "prefetch também é navegação interna"
);
assert(!pedidoPodeRedirecionarSessao("/api/auth/login"), "senha errada não volta para o login");
assert(pedidoPodeRedirecionarSessao("/api/trabalhos"), "api autenticada caída deve ir ao login");
assert(
  respostaIndicaSessaoExpirada({
    status: 401,
    redirected: false,
    urlFinal: "https://lab.example/api/trabalhos",
    urlPedido: "/api/trabalhos",
    origem: "https://lab.example",
  }),
  "401 da api indica sessão caída"
);
assert(
  !respostaIndicaSessaoExpirada({
    status: 401,
    redirected: false,
    urlFinal: "https://lab.example/api/auth/login",
    urlPedido: "/api/auth/login",
    origem: "https://lab.example",
  }),
  "401 do formulário de login não redireciona"
);
assert(
  respostaIndicaSessaoExpirada({
    status: 200,
    redirected: true,
    urlFinal: "https://lab.example/login?redirect=%2Fapp",
    urlPedido: "/app/producao",
    origem: "https://lab.example",
  }),
  "redirect seguido até /login também indica sessão caída"
);

console.log("ok: logout automático vale com o site fechado (cookie 2h)");
