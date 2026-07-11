import type { MessageKey } from "@/lib/i18n";
import {
  ID_CONTA_CAIXA,
  ID_CONTA_CARTEIRA,
  ID_CONTA_NF,
} from "@/lib/conta-bancaria";

const IDS_CONTAS_SISTEMA = new Set([
  ID_CONTA_CAIXA,
  ID_CONTA_CARTEIRA,
  ID_CONTA_NF,
]);

function idAppContaBancaria(id: string): string {
  for (const appId of IDS_CONTAS_SISTEMA) {
    if (id === appId || id.endsWith(`:${appId}`)) return appId;
  }
  return id;
}

function chaveNomeContaBancariaSistema(appId: string): MessageKey {
  return `financeiro.conta.sistema.${appId.replace(/-/g, "_")}` as MessageKey;
}

/** Nome exibido na UI — traduz contas do sistema; contas do usuário mantêm o nome salvo. */
export function nomeExibicaoContaBancaria(
  conta: { id: string; nome: string },
  t: (key: MessageKey) => string
): string {
  const appId = idAppContaBancaria(conta.id);
  if (!IDS_CONTAS_SISTEMA.has(appId)) return conta.nome;
  return t(chaveNomeContaBancariaSistema(appId));
}
