import { configValueFromObservacoes } from "@/lib/cliente-observacoes";
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

function numerosUnicosTelefone(raw: string[]) {
  const vistos = new Set<string>();
  const unicos: string[] = [];
  for (const item of raw) {
    const texto = item.trim();
    if (!texto) continue;
    const chave = normalizarTelefoneBr(texto) || texto.replace(/\D/g, "");
    if (!chave || vistos.has(chave)) continue;
    vistos.add(chave);
    unicos.push(texto);
  }
  return unicos;
}

/** Números do cadastro usados para identificar o cliente no chatbot. */
export function numerosTelefoneClienteChat(cliente: {
  telefone?: string | null;
  celular?: string | null;
  observacoes?: string | null;
}) {
  const bruto: string[] = [];
  const waContato = configValueFromObservacoes(cliente.observacoes, "WhatsApp Contato:");
  const telContato = configValueFromObservacoes(cliente.observacoes, "Telefone Contato:");
  if (waContato.trim()) bruto.push(waContato.trim());
  if (telContato.trim()) bruto.push(telContato.trim());
  const celular = (cliente.celular || "").trim();
  if (celular) bruto.push(celular);
  const telefone = (cliente.telefone || "").trim();
  if (telefone) bruto.push(telefone);
  return numerosUnicosTelefone(bruto);
}

function clienteCoincideTelefoneChat(
  cliente: {
    telefone?: string | null;
    celular?: string | null;
    observacoes?: string | null;
  },
  telefoneEntrada: string
) {
  const alvo = normalizarTelefoneBr(telefoneEntrada);
  if (!alvo) return false;
  return numerosTelefoneClienteChat(cliente).some((numero) =>
    telefonesBrCoincidem(alvo, numero)
  );
}

/** Busca cliente pelos telefones do cadastro (WhatsApp, celular, telefone e contatos). */
export async function buscarClientesPorTelefoneChat(
  empresaId: string,
  telefone: string
): Promise<ClienteChatResumo[]> {
  if (telefone.includes("@")) return [];

  const alvo = normalizarTelefoneBr(telefone);
  if (!alvo) return [];

  const clientes = await runWithTenantContext(empresaId, () =>
    prisma.cliente.findMany({
      where: {
        empresaId,
        ativo: true,
        OR: [
          { celular: { not: null } },
          { telefone: { not: null } },
          { observacoes: { contains: "WhatsApp Contato:", mode: "insensitive" } },
          { observacoes: { contains: "Telefone Contato:", mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        nome: true,
        telefone: true,
        celular: true,
        observacoes: true,
        tokenAcompanhamento: true,
      },
    })
  );

  return clientes
    .filter((cliente) => clienteCoincideTelefoneChat(cliente, alvo))
    .map((cliente) => ({
      id: cliente.id,
      nome: cliente.nome,
      tokenAcompanhamento: cliente.tokenAcompanhamento,
    }));
}

export function contatoWhatsappCadastrado(clientes: ClienteChatResumo[]) {
  return clientes.length > 0;
}
