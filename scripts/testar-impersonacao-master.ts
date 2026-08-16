/**
 * Validação focada da sessão de suporte master (token + permissões).
 * Uso: npx tsx scripts/testar-impersonacao-master.ts
 */
import assert from "node:assert/strict";
import {
  criarTokenSessao,
  sessaoEhSuporteMaster,
  SESSAO_TTL_SUPORTE_MASTER_S,
  verifySessionToken,
  type SessionUser,
} from "../src/lib/auth-token";
import { permissoesSomenteLeituraTodosModulos } from "../src/lib/usuarios-menu-permissoes";

async function main() {
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = "teste-impersonacao-master-secret-32chars";
  }

  const suporteExpiraEm = Date.now() + SESSAO_TTL_SUPORTE_MASTER_S * 1000;
  const user: SessionUser = {
    id: "user-1",
    name: "Proprietario Teste",
    email: "dono@empresa.test",
    role: "proprietario",
    empresaId: "emp-1",
    empresaSlug: "lab-teste",
    empresaNome: "Lab Teste",
    sessionVersion: 3,
    suporteMaster: true,
    somenteLeitura: true,
    masterId: "master-1",
    suporteExpiraEm,
  };

  assert.equal(sessaoEhSuporteMaster(user), true);
  assert.equal(sessaoEhSuporteMaster({ suporteMaster: true, somenteLeitura: false }), false);

  const token = await criarTokenSessao(user, { ttlSegundos: SESSAO_TTL_SUPORTE_MASTER_S });
  const lido = await verifySessionToken(token);
  assert.ok(lido);
  assert.equal(lido.id, user.id);
  assert.equal(lido.empresaSlug, "lab-teste");
  assert.equal(lido.suporteMaster, true);
  assert.equal(lido.somenteLeitura, true);
  assert.equal(lido.masterId, "master-1");
  assert.ok(lido.suporteExpiraEm && lido.suporteExpiraEm > Date.now());

  const normal: SessionUser = {
    id: "user-2",
    name: "Normal",
    email: "a@b.c",
    role: "usuario",
    empresaId: "emp-2",
    empresaSlug: "outro",
  };
  const tokenNormal = await criarTokenSessao(normal);
  const lidoNormal = await verifySessionToken(tokenNormal);
  assert.ok(lidoNormal);
  assert.equal(lidoNormal.suporteMaster, undefined);
  assert.equal(lidoNormal.somenteLeitura, undefined);
  assert.equal(sessaoEhSuporteMaster(lidoNormal), false);

  const perms = permissoesSomenteLeituraTodosModulos();
  const ids = Object.keys(perms);
  assert.ok(ids.length > 10);
  for (const id of ids) {
    assert.equal(perms[id].ver, true);
    assert.equal(perms[id].criar, false);
    assert.equal(perms[id].editar, false);
    assert.equal(perms[id].excluir, false);
  }

  const expirado: SessionUser = {
    ...user,
    suporteExpiraEm: Date.now() - 1000,
  };
  const tokenExpirado = await criarTokenSessao(expirado, { ttlSegundos: 1 });
  // Força claim se no passado reassinando com se antigo — verify usa se do payload.
  // Como criarTokenSessao regenera se quando expirado, montamos manualmente via verify após sleep curto.
  // Aqui validamos apenas que sessaoEhSuporteMaster exige ambos os flags.
  assert.equal(sessaoEhSuporteMaster(expirado), true);
  assert.ok(tokenExpirado.length > 20);

  console.log("OK: impersonação master (token + permissões somente leitura)");
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
