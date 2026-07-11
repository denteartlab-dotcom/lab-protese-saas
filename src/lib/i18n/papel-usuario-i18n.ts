import type { MessageKey } from "@/lib/i18n";

const CHAVE_POR_PAPEL: Record<string, MessageKey> = {
  admin: "user.proprietario",
  proprietario: "user.proprietario",
  admin_empresa: "user.proprietario",
  gerente: "user.gerente",
  financeiro: "user.financeiro",
  producao: "user.producao",
  usuario: "user.usuario",
};

type Tradutor = (key: MessageKey, params?: Record<string, string | number>) => string;

export function rotuloPapelUsuarioI18n(role: string, t: Tradutor): string {
  const chave = CHAVE_POR_PAPEL[role];
  if (chave) return t(chave);
  return role;
}
