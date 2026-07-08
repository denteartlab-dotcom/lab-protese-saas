import { prisma } from "@/lib/db";
import { runWithTenantContext } from "@/lib/prisma-tenant";
import type { ContatoImportado } from "@/lib/whatsapp-disparos/telefone-br";

export type CampanhaPublica = {
  id: string;
  nome: string;
  mensagem: string;
  status: string;
  origemContatos: string;
  intervaloSegundos: number;
  atrasoAleatorio: boolean;
  limitePorHora: number | null;
  agendadoPara: string | null;
  totalContatos: number;
  enviadas: number;
  pendentes: number;
  falhas: number;
  anexoTipo: string | null;
  anexoNome: string | null;
  userName: string | null;
  iniciadoEm: string | null;
  concluidoEm: string | null;
  createdAt: string;
  updatedAt: string;
};

function serializarCampanha(row: {
  id: string;
  nome: string;
  mensagem: string;
  status: string;
  origemContatos: string;
  intervaloSegundos: number;
  atrasoAleatorio: boolean;
  limitePorHora: number | null;
  agendadoPara: Date | null;
  totalContatos: number;
  enviadas: number;
  pendentes: number;
  falhas: number;
  anexoTipo: string | null;
  anexoNome: string | null;
  userName: string | null;
  iniciadoEm: Date | null;
  concluidoEm: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): CampanhaPublica {
  return {
    id: row.id,
    nome: row.nome,
    mensagem: row.mensagem,
    status: row.status,
    origemContatos: row.origemContatos,
    intervaloSegundos: row.intervaloSegundos,
    atrasoAleatorio: row.atrasoAleatorio,
    limitePorHora: row.limitePorHora,
    agendadoPara: row.agendadoPara?.toISOString() || null,
    totalContatos: row.totalContatos,
    enviadas: row.enviadas,
    pendentes: row.pendentes,
    falhas: row.falhas,
    anexoTipo: row.anexoTipo,
    anexoNome: row.anexoNome,
    userName: row.userName,
    iniciadoEm: row.iniciadoEm?.toISOString() || null,
    concluidoEm: row.concluidoEm?.toISOString() || null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listarCampanhasWhatsapp(
  empresaId: string,
  opts?: { status?: string; busca?: string; limite?: number }
) {
  const where: {
    empresaId: string;
    status?: string | { in: string[] };
    nome?: { contains: string; mode: "insensitive" };
  } = { empresaId };

  if (opts?.status && opts.status !== "todos") {
    where.status = opts.status;
  }
  if (opts?.busca?.trim()) {
    where.nome = { contains: opts.busca.trim() };
  }

  const rows = await runWithTenantContext(empresaId, () =>
    prisma.whatsappCampaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: opts?.limite ?? 50,
    })
  );
  return rows.map(serializarCampanha);
}

export async function obterCampanhaWhatsapp(empresaId: string, id: string) {
  const row = await runWithTenantContext(empresaId, () =>
    prisma.whatsappCampaign.findFirst({ where: { id, empresaId } })
  );
  return row ? serializarCampanha(row) : null;
}

export async function metricasDisparosWhatsapp(empresaId: string) {
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);

  const [totalCampanhas, enviadasHoje, pendentes, falhas] = await runWithTenantContext(
    empresaId,
    async () => {
      const [tc, logsHoje, pend, fal] = await Promise.all([
        prisma.whatsappCampaign.count({ where: { empresaId } }),
        prisma.whatsappLog.count({
          where: { empresaId, status: "enviado", createdAt: { gte: inicioHoje } },
        }),
        prisma.whatsappCampaignContact.count({
          where: {
            campaign: { empresaId },
            status: { in: ["aguardando", "pausado", "enviando"] },
          },
        }),
        prisma.whatsappCampaignContact.count({
          where: { campaign: { empresaId }, status: "falhou" },
        }),
      ]);
      return [tc, logsHoje, pend, fal] as const;
    }
  );

  return { totalCampanhas, enviadasHoje, pendentes, falhas };
}

export async function criarCampanhaWhatsapp(
  empresaId: string,
  dados: {
    nome: string;
    mensagem: string;
    origemContatos: string;
    intervaloSegundos: number;
    atrasoAleatorio: boolean;
    limitePorHora: number | null;
    agendadoPara?: Date | null;
    status?: string;
    userId?: string;
    userName?: string;
    anexoTipo?: string | null;
    anexoNome?: string | null;
    anexoMime?: string | null;
    anexoUploadId?: string | null;
    contatos?: ContatoImportado[];
  }
) {
  const contatos = dados.contatos || [];
  const row = await runWithTenantContext(empresaId, () =>
    prisma.whatsappCampaign.create({
      data: {
        empresaId,
        nome: dados.nome,
        mensagem: dados.mensagem,
        origemContatos: dados.origemContatos,
        intervaloSegundos: dados.intervaloSegundos,
        atrasoAleatorio: dados.atrasoAleatorio,
        limitePorHora: dados.limitePorHora,
        agendadoPara: dados.agendadoPara || null,
        status: dados.status || "rascunho",
        userId: dados.userId,
        userName: dados.userName,
        anexoTipo: dados.anexoTipo || null,
        anexoNome: dados.anexoNome || null,
        anexoMime: dados.anexoMime || null,
        anexoUploadId: dados.anexoUploadId || null,
        totalContatos: contatos.length,
        pendentes: contatos.length,
        contatos: {
          create: contatos.map((c) => ({
            nome: c.nome,
            telefone: c.telefoneNormalizado,
            cidade: c.cidade,
            empresaNome: c.empresaNome,
            dentista: c.dentista,
            consulta: c.consulta,
            valor: c.valor,
            vencimento: c.vencimento,
            status: "aguardando",
          })),
        },
      },
    })
  );
  return serializarCampanha(row);
}

export async function duplicarCampanhaWhatsapp(empresaId: string, id: string, userName?: string) {
  const original = await runWithTenantContext(empresaId, () =>
    prisma.whatsappCampaign.findFirst({
      where: { id, empresaId },
      include: { contatos: true },
    })
  );
  if (!original) return null;

  const row = await runWithTenantContext(empresaId, () =>
    prisma.whatsappCampaign.create({
      data: {
        empresaId,
        nome: `${original.nome} (cópia)`,
        mensagem: original.mensagem,
        origemContatos: original.origemContatos,
        intervaloSegundos: original.intervaloSegundos,
        atrasoAleatorio: original.atrasoAleatorio,
        limitePorHora: original.limitePorHora,
        status: "rascunho",
        userName: userName || original.userName,
        anexoTipo: original.anexoTipo,
        anexoNome: original.anexoNome,
        anexoMime: original.anexoMime,
        anexoUploadId: original.anexoUploadId,
        totalContatos: original.contatos.length,
        pendentes: original.contatos.length,
        contatos: {
          create: original.contatos.map((c) => ({
            nome: c.nome,
            telefone: c.telefone,
            cidade: c.cidade,
            empresaNome: c.empresaNome,
            dentista: c.dentista,
            consulta: c.consulta,
            valor: c.valor,
            vencimento: c.vencimento,
            status: "aguardando",
          })),
        },
      },
    })
  );
  return serializarCampanha(row);
}

export async function excluirCampanhaWhatsapp(empresaId: string, id: string) {
  await runWithTenantContext(empresaId, () =>
    prisma.whatsappCampaign.deleteMany({ where: { id, empresaId } })
  );
}

export async function listarContatosCampanha(
  empresaId: string,
  campaignId: string,
  limite = 100
) {
  return runWithTenantContext(empresaId, () =>
    prisma.whatsappCampaignContact.findMany({
      where: { campaignId, campaign: { empresaId } },
      orderBy: { updatedAt: "desc" },
      take: limite,
      select: {
        id: true,
        nome: true,
        telefone: true,
        status: true,
        tentativas: true,
        erro: true,
        enviadoEm: true,
        updatedAt: true,
      },
    })
  );
}

export async function carregarContatosOrigem(
  empresaId: string,
  origem: "pacientes" | "clientes"
) {
  if (origem === "clientes") {
    const clientes = await runWithTenantContext(empresaId, () =>
      prisma.cliente.findMany({
        where: { empresaId, ativo: true },
        select: { nome: true, celular: true, telefone: true, cidade: true },
      })
    );
    const { deduplicarContatos, normalizarTelefoneBr } = await import(
      "@/lib/whatsapp-disparos/telefone-br"
    );
    const contatos = clientes.map((c) => {
      const tel = c.celular || c.telefone || "";
      const norm = normalizarTelefoneBr(tel);
      return {
        nome: c.nome,
        telefone: tel,
        telefoneNormalizado: norm || "",
        cidade: c.cidade || undefined,
        valido: Boolean(norm),
      };
    });
    return deduplicarContatos(contatos);
  }

  const pacientes = await runWithTenantContext(empresaId, () =>
    prisma.paciente.findMany({
      where: { cliente: { empresaId } },
      select: {
        nome: true,
        telefone: true,
        cliente: { select: { nome: true, cidade: true } },
      },
    })
  );
  const { deduplicarContatos, normalizarTelefoneBr } = await import(
    "@/lib/whatsapp-disparos/telefone-br"
  );
  const contatos = pacientes.map((p) => {
    const norm = normalizarTelefoneBr(p.telefone || "");
    return {
      nome: p.nome,
      telefone: p.telefone || "",
      telefoneNormalizado: norm || "",
      cidade: p.cliente.cidade || undefined,
      dentista: p.cliente.nome,
      valido: Boolean(norm),
    };
  });
  return deduplicarContatos(contatos);
}

export async function sincronizarSessaoWhatsapp(
  empresaId: string,
  dados: { conectado: boolean; numero?: string | null }
) {
  return runWithTenantContext(empresaId, () =>
    prisma.whatsappSession.upsert({
      where: { empresaId },
      create: {
        empresaId,
        status: dados.conectado ? "conectado" : "desconectado",
        numeroConectado: dados.numero || null,
        ultimaConexaoEm: dados.conectado ? new Date() : null,
      },
      update: {
        status: dados.conectado ? "conectado" : "desconectado",
        numeroConectado: dados.numero || null,
        ultimaConexaoEm: dados.conectado ? new Date() : undefined,
      },
    })
  );
}

export async function obterSessaoWhatsapp(empresaId: string) {
  return runWithTenantContext(empresaId, () =>
    prisma.whatsappSession.findUnique({ where: { empresaId } })
  );
}
