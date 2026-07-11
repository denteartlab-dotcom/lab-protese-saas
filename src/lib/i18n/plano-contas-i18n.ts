import type { MessageKey } from "@/lib/i18n";
import {
  contaCriadaPeloUsuario,
  type ItemPlanoContas,
} from "@/lib/plano-contas";

function chaveNomePlanoContas(id: string): MessageKey {
  return `financeiro.plano.item.${id.replace(/-/g, "_")}` as MessageKey;
}

/** Nome exibido na UI — traduz contas padrão; contas do usuário mantêm o nome salvo. */
export function nomeExibicaoPlanoContas(
  item: ItemPlanoContas,
  t: (key: MessageKey) => string
): string {
  if (contaCriadaPeloUsuario(item)) return item.nome;
  return t(chaveNomePlanoContas(item.id));
}
