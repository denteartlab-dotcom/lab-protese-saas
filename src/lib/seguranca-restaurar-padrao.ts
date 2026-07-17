import { hashPassword, verifyPassword } from "@/lib/auth";
import { executarSemRls, prisma } from "@/lib/db";

export const JSON_KEY_PALAVRA_CHAVE_RESTAURAR = "labProtesePalavraChaveRestaurar";
export const JSON_KEY_TENTATIVAS_SENHA_RESTAURAR = "labProteseTentativasSenhaRestaurar";

export const MAX_TENTATIVAS_SENHA_RESTAURAR = 2;

type PalavraChaveArmazenada = {
  hash: string;
  referencia: string;
  atualizadoEm: string;
};

type MapaTentativas = Record<string, { tentativas: number }>;

// Chaves globais (sem prefixo t:<tenant>:) — RLS do JsonStore exige bypass explícito.
async function lerJsonStore<T>(key: string): Promise<T | null> {
  const row = await executarSemRls((tx) => tx.jsonStore.findUnique({ where: { key } }));
  if (!row?.payload) return null;
  try {
    return JSON.parse(row.payload) as T;
  } catch {
    return null;
  }
}

async function gravarJsonStore(key: string, valor: unknown) {
  const payload = JSON.stringify(valor);
  await executarSemRls((tx) =>
    tx.jsonStore.upsert({
      where: { key },
      create: { key, payload },
      update: { payload },
    })
  );
}

export async function obterPalavraChaveRestaurar() {
  const data = await lerJsonStore<PalavraChaveArmazenada>(
    JSON_KEY_PALAVRA_CHAVE_RESTAURAR
  );
  if (!data?.hash) return null;
  return {
    referencia: data.referencia?.trim() || "",
    atualizadoEm: data.atualizadoEm,
  };
}

export async function palavraChaveRestaurarCadastrada() {
  const row = await lerJsonStore<PalavraChaveArmazenada>(
    JSON_KEY_PALAVRA_CHAVE_RESTAURAR
  );
  return Boolean(row?.hash);
}

export async function cadastrarOuAlterarPalavraChaveRestaurar(opts: {
  palavraChave: string;
  referencia: string;
  palavraChaveAtual?: string;
}) {
  const chave = opts.palavraChave.trim();
  const referencia = opts.referencia.trim();
  if (chave.length < 4) {
    throw new Error("A palavra-chave deve ter pelo menos 4 caracteres.");
  }
  if (!referencia) {
    throw new Error("Informe uma referência para lembrar da palavra-chave.");
  }

  const existente = await lerJsonStore<PalavraChaveArmazenada>(
    JSON_KEY_PALAVRA_CHAVE_RESTAURAR
  );

  if (existente?.hash) {
    const atual = opts.palavraChaveAtual?.trim() ?? "";
    if (!atual) {
      throw new Error(
        "Já existe uma palavra-chave cadastrada. Informe a palavra-chave atual para alterá-la."
      );
    }
    const ok = await verifyPassword(atual, existente.hash);
    if (!ok) {
      throw new Error("Palavra-chave atual incorreta.");
    }
  }

  const hash = await hashPassword(chave);
  await gravarJsonStore(JSON_KEY_PALAVRA_CHAVE_RESTAURAR, {
    hash,
    referencia,
    atualizadoEm: new Date().toISOString(),
  } satisfies PalavraChaveArmazenada);
}

export async function verificarPalavraChaveRestaurar(palavraChave: string) {
  const data = await lerJsonStore<PalavraChaveArmazenada>(
    JSON_KEY_PALAVRA_CHAVE_RESTAURAR
  );
  if (!data?.hash) return false;
  return verifyPassword(palavraChave.trim(), data.hash);
}

async function lerTentativasMapa(): Promise<MapaTentativas> {
  return (await lerJsonStore<MapaTentativas>(JSON_KEY_TENTATIVAS_SENHA_RESTAURAR)) ?? {};
}

async function gravarTentativasMapa(mapa: MapaTentativas) {
  await gravarJsonStore(JSON_KEY_TENTATIVAS_SENHA_RESTAURAR, mapa);
}

export async function obterTentativasSenhaRestaurar(usuarioId: string) {
  const mapa = await lerTentativasMapa();
  return mapa[usuarioId]?.tentativas ?? 0;
}

export async function incrementarTentativaSenhaRestaurar(usuarioId: string) {
  const mapa = await lerTentativasMapa();
  const atual = mapa[usuarioId]?.tentativas ?? 0;
  const tentativas = atual + 1;
  mapa[usuarioId] = { tentativas };
  await gravarTentativasMapa(mapa);
  return tentativas;
}

export async function zerarTentativasSenhaRestaurar(usuarioId: string) {
  const mapa = await lerTentativasMapa();
  delete mapa[usuarioId];
  await gravarTentativasMapa(mapa);
}

export function exigePalavraChavePorTentativas(tentativas: number) {
  return tentativas >= MAX_TENTATIVAS_SENHA_RESTAURAR;
}

export async function verificarSenhaProprietario(usuarioId: string, senha: string) {
  const user = await prisma.user.findUnique({
    where: { id: usuarioId },
    select: { password: true },
  });
  if (!user?.password) return false;
  return verifyPassword(senha, user.password);
}

export type ResultadoAutenticacaoRestaurar =
  | { ok: true }
  | {
      ok: false;
      error: string;
      tentativasSenha?: number;
      exigePalavraChave?: boolean;
      palavraChaveCadastrada?: boolean;
    };

export async function autenticarRestaurarPadrao(
  usuarioId: string,
  credenciais: { senha?: string; palavraChave?: string }
): Promise<ResultadoAutenticacaoRestaurar> {
  const tentativas = await obterTentativasSenhaRestaurar(usuarioId);
  const exigePalavra = exigePalavraChavePorTentativas(tentativas);
  const palavraCadastrada = await palavraChaveRestaurarCadastrada();

  if (exigePalavra) {
    const chave = credenciais.palavraChave?.trim() ?? "";
    if (!chave) {
      return {
        ok: false,
        error: palavraCadastrada
          ? "Após 2 senhas incorretas, informe a palavra-chave de recuperação."
          : "Após 2 senhas incorretas, cadastre uma palavra-chave de recuperação em Backup antes de continuar.",
        tentativasSenha: tentativas,
        exigePalavraChave: true,
        palavraChaveCadastrada: palavraCadastrada,
      };
    }
    if (!palavraCadastrada) {
      return {
        ok: false,
        error:
          "Nenhuma palavra-chave cadastrada. Cadastre em Configurações → Backup.",
        exigePalavraChave: true,
        palavraChaveCadastrada: false,
      };
    }
    const okChave = await verificarPalavraChaveRestaurar(chave);
    if (!okChave) {
      return {
        ok: false,
        error: "Palavra-chave de recuperação incorreta.",
        tentativasSenha: tentativas,
        exigePalavraChave: true,
        palavraChaveCadastrada: true,
      };
    }
    await zerarTentativasSenhaRestaurar(usuarioId);
    return { ok: true };
  }

  const senha = credenciais.senha ?? "";
  if (!senha) {
    return {
      ok: false,
      error: "Informe a senha do proprietário.",
      tentativasSenha: tentativas,
      exigePalavraChave: false,
    };
  }

  const okSenha = await verificarSenhaProprietario(usuarioId, senha);
  if (!okSenha) {
    const novas = await incrementarTentativaSenhaRestaurar(usuarioId);
    const bloqueado = exigePalavraChavePorTentativas(novas);
    return {
      ok: false,
      error: bloqueado
        ? "Senha incorreta. Informe a palavra-chave de recuperação."
        : `Senha incorreta. Tentativa ${novas} de ${MAX_TENTATIVAS_SENHA_RESTAURAR}.`,
      tentativasSenha: novas,
      exigePalavraChave: bloqueado,
      palavraChaveCadastrada: await palavraChaveRestaurarCadastrada(),
    };
  }

  await zerarTentativasSenhaRestaurar(usuarioId);
  return { ok: true };
}
