/**
 * Sessão cai após 2h mesmo com o site fechado (cookie/iat).
 * Uso: npx tsx scripts/testar-sessao-inatividade.ts
 */
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

console.log("ok: logout automático vale com o site fechado (cookie 2h)");
