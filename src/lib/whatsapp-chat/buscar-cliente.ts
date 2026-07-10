import { prisma } from "@/lib/db";
import { runWithTenantContext } from "@/lib/prisma-tenant";
import {
  normalizarTelefoneBr,
  telefonesBrCoincidem,
} from "@/lib/whatsapp-disparos/telefone-br";

export type ClienteChatResumo = {
  id: string;
  nome: string;
  tokenAcompanhamento: string | null;
};

export async function buscarClientesPorTelefoneChat(
  empresaId: string,
  telefone: string
): Promise<ClienteChatResumo[]> {
  const alvo = normalizarTelefoneBr(telefone);
  if (!alvo) return [];

  const clientes = await runWithTenantContext(empresaId, () =>
    prisma.cliente.findMany({
      where: {
        empresaId,
        ativo: true,
        OR: [{ celular: { not: null } }, { telefone: { not: null } }],
      },
      select: {
        id: true,
        nome: true,
        celular: true,
        telefone: true,
        tokenAcompanhamento: true,
      },
    })
  );

  return clientes
    .filter((cliente) => {
      const cel = cliente.celular || "";
      const tel = cliente.telefone || "";
      return telefonesBrCoincidem(alvo, cel) || telefonesBrCoincidem(alvo, tel);
    })
    .map((cliente) => ({
      id: cliente.id,
      nome: cliente.nome,
      tokenAcompanhamento: cliente.tokenAcompanhamento,
    }));
}
