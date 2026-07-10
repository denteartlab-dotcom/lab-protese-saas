import { clienteTemWhatsappCadastrado, numerosWhatsappClienteCadastro } from "@/lib/cliente-observacoes";
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

function clienteCoincideWhatsapp(
  cliente: {
    celular?: string | null;
    observacoes?: string | null;
  },
  telefoneEntrada: string
) {
  const alvo = normalizarTelefoneBr(telefoneEntrada);
  if (!alvo) return false;
  return numerosWhatsappClienteCadastro(cliente).some((numero) =>
    telefonesBrCoincidem(alvo, numero)
  );
}

/** Busca cliente pelo WhatsApp cadastrado (campo WhatsApp/celular e WhatsApp do contato). */
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
        OR: [
          { celular: { not: null } },
          { observacoes: { contains: "WhatsApp Contato:", mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        nome: true,
        celular: true,
        observacoes: true,
        tokenAcompanhamento: true,
      },
    })
  );

  return clientes
    .filter(
      (cliente) =>
        clienteTemWhatsappCadastrado(cliente) &&
        clienteCoincideWhatsapp(cliente, alvo)
    )
    .map((cliente) => ({
      id: cliente.id,
      nome: cliente.nome,
      tokenAcompanhamento: cliente.tokenAcompanhamento,
    }));
}
