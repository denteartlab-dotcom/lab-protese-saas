/**
 * Integração Open Finance via Pluggy (https://pluggy.ai).
 * Requer PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET no servidor (.env).
 */

import type { ExtratoMovimentacao } from "@/lib/extrato-bancario";
import { fetchComTimeout } from "@/lib/http-integracao";

const PLUGGY_API = "https://api.pluggy.ai";

export type PluggyConfig = {
  configurado: boolean;
  mensagem?: string;
};

export function pluggyConfigurado() {
  return Boolean(
    process.env.PLUGGY_CLIENT_ID?.trim() &&
      process.env.PLUGGY_CLIENT_SECRET?.trim()
  );
}

async function pluggyApiKey() {
  const clientId = process.env.PLUGGY_CLIENT_ID?.trim();
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error(
      "Open Finance não configurado. Defina PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET no .env do servidor."
    );
  }

  const res = await fetchComTimeout(
    `${PLUGGY_API}/auth`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, clientSecret }),
    },
    { integracao: "pluggy" }
  );

  if (!res.ok) {
    throw new Error("Falha ao autenticar na Pluggy. Verifique as credenciais.");
  }

  const json = (await res.json()) as { apiKey: string };
  return json.apiKey;
}

export async function criarConnectToken(itemId?: string) {
  const apiKey = await pluggyApiKey();
  const res = await fetchComTimeout(
    `${PLUGGY_API}/connect_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({
        ...(itemId ? { itemId } : {}),
        options: {
          clientUserId: "lab-protese",
          openFinance: true,
        },
      }),
    },
    { integracao: "pluggy" }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Não foi possível gerar o token de conexão.");
  }

  const json = (await res.json()) as { accessToken: string };
  return json.accessToken;
}

type PluggyTransaction = {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: string;
};

export async function buscarTransacoesPluggy(
  itemId: string,
  dias = 90
): Promise<PluggyTransaction[]> {
  const apiKey = await pluggyApiKey();

  const accountsRes = await fetchComTimeout(
    `${PLUGGY_API}/accounts?itemId=${encodeURIComponent(itemId)}`,
    { headers: { "X-API-KEY": apiKey } },
    { integracao: "pluggy" }
  );
  if (!accountsRes.ok) {
    throw new Error("Não foi possível listar contas do banco conectado.");
  }

  const accountsJson = (await accountsRes.json()) as {
    results: Array<{ id: string }>;
  };
  const accountId = accountsJson.results?.[0]?.id;
  if (!accountId) return [];

  const ate = new Date();
  const de = new Date();
  de.setDate(de.getDate() - dias);

  const params = new URLSearchParams({
    accountId,
    from: de.toISOString().slice(0, 10),
    to: ate.toISOString().slice(0, 10),
    pageSize: "500",
  });

  const txRes = await fetchComTimeout(
    `${PLUGGY_API}/transactions?${params}`,
    { headers: { "X-API-KEY": apiKey } },
    { integracao: "pluggy" }
  );
  if (!txRes.ok) {
    throw new Error("Não foi possível buscar transações do extrato.");
  }

  const txJson = (await txRes.json()) as { results: PluggyTransaction[] };
  return txJson.results ?? [];
}

export function transacoesParaExtrato(
  contaId: string,
  transacoes: PluggyTransaction[]
): ExtratoMovimentacao[] {
  return transacoes.map((tx) => {
    const credito =
      tx.type === "CREDIT" || tx.amount > 0 || tx.type === "INFLOW";
    return {
      id: `pluggy-${tx.id}`,
      contaId,
      tipo: credito ? ("entrada" as const) : ("saida" as const),
      valor: Math.abs(tx.amount),
      descricao: tx.description || "Movimentação bancária",
      data: new Date(tx.date).toISOString(),
      origem: "open_finance" as const,
      idExterno: tx.id,
    };
  });
}
