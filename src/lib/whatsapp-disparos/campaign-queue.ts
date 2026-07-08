import { prisma } from "@/lib/db";
import { runWithTenantContext } from "@/lib/prisma-tenant";
import {
  aplicarVariaveisMensagem,
  estimarDuracaoDisparo,
  type VariaveisContato,
} from "@/lib/whatsapp-disparos/mensagem-variaveis";
import {
  baileysEnviarMidia,
  baileysEnviarTexto,
  baileysConfigurado,
} from "@/lib/whatsapp-disparos/baileys-service";
import {
  emitDisparoContato,
  emitDisparoProgresso,
} from "@/lib/whatsapp-disparos/disparos-socket-io";
import { formatarTelefoneExibicao } from "@/lib/whatsapp-disparos/telefone-br";

type EstadoFila = {
  campaignId: string;
  empresaId: string;
  pausado: boolean;
  cancelado: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  enviosNaHora: number[];
};

const filasAtivas = new Map<string, EstadoFila>();

function chaveFila(empresaId: string, campaignId: string) {
  return `${empresaId}:${campaignId}`;
}

function intervaloComAtraso(base: number, aleatorio: boolean) {
  if (!aleatorio) return base * 1000;
  const extra = Math.floor(Math.random() * base * 1000);
  return base * 1000 + extra;
}

function podeEnviarNaHora(estado: EstadoFila, limite: number | null) {
  if (!limite) return true;
  const agora = Date.now();
  estado.enviosNaHora = estado.enviosNaHora.filter((t) => agora - t < 3_600_000);
  return estado.enviosNaHora.length < limite;
}

async function carregarAnexoBase64(anexoUploadId: string | null, empresaId: string) {
  if (!anexoUploadId) return null;
  const arquivo = await runWithTenantContext(empresaId, () =>
    prisma.arquivoUpload.findFirst({
      where: { id: anexoUploadId, empresaId },
      select: { dados: true, mimeType: true, nome: true },
    })
  );
  if (!arquivo) return null;
  return {
    mimeType: arquivo.mimeType,
    fileName: arquivo.nome,
    dataBase64: Buffer.from(arquivo.dados).toString("base64"),
  };
}

async function registrarLog(
  empresaId: string,
  campaignId: string,
  contactId: string,
  status: string,
  mensagem: string | null,
  erro: string | null,
  tentativas: number
) {
  await runWithTenantContext(empresaId, () =>
    prisma.whatsappLog.create({
      data: {
        empresaId,
        campaignId,
        contactId,
        status,
        mensagem,
        erro,
        tentativas,
      },
    })
  );
}

async function atualizarContadoresCampanha(empresaId: string, campaignId: string) {
  const [enviadas, pendentes, falhas, total] = await runWithTenantContext(empresaId, async () => {
    const [e, p, f, t] = await Promise.all([
      prisma.whatsappCampaignContact.count({
        where: { campaignId, status: "enviado" },
      }),
      prisma.whatsappCampaignContact.count({
        where: { campaignId, status: { in: ["aguardando", "enviando", "pausado"] } },
      }),
      prisma.whatsappCampaignContact.count({
        where: { campaignId, status: "falhou" },
      }),
      prisma.whatsappCampaignContact.count({ where: { campaignId } }),
    ]);
    return [e, p, f, t] as const;
  });

  const campanha = await runWithTenantContext(empresaId, () =>
    prisma.whatsappCampaign.update({
      where: { id: campaignId },
      data: { enviadas, pendentes, falhas, totalContatos: total },
      select: {
        status: true,
        intervaloSegundos: true,
        atrasoAleatorio: true,
      },
    })
  );

  const percentual = total > 0 ? Math.round((enviadas / total) * 100) : 0;
  const restantes = pendentes + (await runWithTenantContext(empresaId, () =>
    prisma.whatsappCampaignContact.count({
      where: { campaignId, status: "enviando" },
    })
  ));
  const tempoRestante = estimarDuracaoDisparo(
    restantes,
    campanha.intervaloSegundos,
    campanha.atrasoAleatorio
  );

  emitDisparoProgresso(empresaId, {
    campaignId,
    status: campanha.status,
    total,
    enviadas,
    pendentes,
    falhas,
    percentual,
    tempoRestanteSegundos: tempoRestante,
    intervaloSegundos: campanha.intervaloSegundos,
  });

  if (pendentes === 0 && campanha.status === "enviando") {
    await runWithTenantContext(empresaId, () =>
      prisma.whatsappCampaign.update({
        where: { id: campaignId },
        data: { status: "concluida", concluidoEm: new Date(), pendentes: 0 },
      })
    );
    pararFila(empresaId, campaignId);
  }

  return { enviadas, pendentes, falhas, total };
}

async function enviarParaContato(
  empresaId: string,
  campaignId: string,
  contactId: string,
  mensagemTemplate: string,
  anexo: Awaited<ReturnType<typeof carregarAnexoBase64>>,
  anexoTipo: string | null
) {
  const contato = await runWithTenantContext(empresaId, () =>
    prisma.whatsappCampaignContact.update({
      where: { id: contactId },
      data: { status: "enviando", tentativas: { increment: 1 } },
      select: {
        id: true,
        nome: true,
        telefone: true,
        cidade: true,
        empresaNome: true,
        dentista: true,
        consulta: true,
        valor: true,
        vencimento: true,
        tentativas: true,
      },
    })
  );

  const vars: VariaveisContato = {
    nome: contato.nome,
    telefone: formatarTelefoneExibicao(contato.telefone),
    cidade: contato.cidade || undefined,
    empresa: contato.empresaNome || undefined,
    dentista: contato.dentista || undefined,
    consulta: contato.consulta || undefined,
    valor: contato.valor || undefined,
    vencimento: contato.vencimento || undefined,
  };

  const mensagem = aplicarVariaveisMensagem(mensagemTemplate, vars);

  try {
    if (!baileysConfigurado()) {
      throw new Error("Baileys não configurado no servidor.");
    }

    if (anexo && anexoTipo) {
      await baileysEnviarMidia(contato.telefone, {
        mensagem,
        mimeType: anexo.mimeType,
        fileName: anexo.fileName,
        dataBase64: anexo.dataBase64,
        tipo: anexoTipo as "imagem" | "pdf" | "documento" | "video" | "audio",
      });
    } else {
      await baileysEnviarTexto(contato.telefone, mensagem);
    }

    const atualizado = await runWithTenantContext(empresaId, () =>
      prisma.whatsappCampaignContact.update({
        where: { id: contactId },
        data: { status: "enviado", enviadoEm: new Date(), erro: null },
      })
    );

    await registrarLog(
      empresaId,
      campaignId,
      contactId,
      "enviado",
      mensagem,
      null,
      contato.tentativas
    );

    emitDisparoContato(empresaId, {
      campaignId,
      contactId,
      nome: contato.nome,
      telefone: contato.telefone,
      status: "enviado",
      tentativas: contato.tentativas,
      erro: null,
      enviadoEm: atualizado.enviadoEm?.toISOString() || new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Falha no envio";
    await runWithTenantContext(empresaId, () =>
      prisma.whatsappCampaignContact.update({
        where: { id: contactId },
        data: { status: "falhou", erro: msg },
      })
    );
    await registrarLog(
      empresaId,
      campaignId,
      contactId,
      "falhou",
      mensagem,
      msg,
      contato.tentativas
    );
    emitDisparoContato(empresaId, {
      campaignId,
      contactId,
      nome: contato.nome,
      telefone: contato.telefone,
      status: "falhou",
      tentativas: contato.tentativas,
      erro: msg,
      enviadoEm: null,
    });
  }
}

async function processarProximo(empresaId: string, campaignId: string) {
  const key = chaveFila(empresaId, campaignId);
  const estado = filasAtivas.get(key);
  if (!estado || estado.cancelado) return;

  const campanha = await runWithTenantContext(empresaId, () =>
    prisma.whatsappCampaign.findFirst({
      where: { id: campaignId, empresaId },
    })
  );
  if (!campanha || campanha.status === "cancelada" || campanha.status === "concluida") {
    pararFila(empresaId, campaignId);
    return;
  }

  if (estado.pausado || campanha.status === "pausada") {
    estado.pausado = true;
    return;
  }

  if (campanha.agendadoPara && campanha.agendadoPara > new Date()) {
    estado.timer = setTimeout(() => void processarProximo(empresaId, campaignId), 5000);
    return;
  }

  if (!podeEnviarNaHora(estado, campanha.limitePorHora)) {
    estado.timer = setTimeout(() => void processarProximo(empresaId, campaignId), 60_000);
    return;
  }

  const proximo = await runWithTenantContext(empresaId, () =>
    prisma.whatsappCampaignContact.findFirst({
      where: { campaignId, status: "aguardando" },
      orderBy: { createdAt: "asc" },
    })
  );

  if (!proximo) {
    await atualizarContadoresCampanha(empresaId, campaignId);
    return;
  }

  const anexo = await carregarAnexoBase64(campanha.anexoUploadId, empresaId);
  await enviarParaContato(
    empresaId,
    campaignId,
    proximo.id,
    campanha.mensagem,
    anexo,
    campanha.anexoTipo
  );
  estado.enviosNaHora.push(Date.now());
  await atualizarContadoresCampanha(empresaId, campaignId);

  if (estado.cancelado || estado.pausado) return;

  const delay = intervaloComAtraso(campanha.intervaloSegundos, campanha.atrasoAleatorio);
  estado.timer = setTimeout(() => void processarProximo(empresaId, campaignId), delay);
}

export async function iniciarFilaCampanha(empresaId: string, campaignId: string) {
  const key = chaveFila(empresaId, campaignId);
  if (filasAtivas.has(key)) {
    const estado = filasAtivas.get(key)!;
    estado.pausado = false;
    estado.cancelado = false;
    void processarProximo(empresaId, campaignId);
    return;
  }

  await runWithTenantContext(empresaId, () =>
    prisma.whatsappCampaign.update({
      where: { id: campaignId },
      data: {
        status: "enviando",
        iniciadoEm: new Date(),
        concluidoEm: null,
      },
    })
  );

  filasAtivas.set(key, {
    campaignId,
    empresaId,
    pausado: false,
    cancelado: false,
    timer: null,
    enviosNaHora: [],
  });

  void processarProximo(empresaId, campaignId);
}

export async function pausarFilaCampanha(empresaId: string, campaignId: string) {
  const key = chaveFila(empresaId, campaignId);
  const estado = filasAtivas.get(key);
  if (estado) {
    estado.pausado = true;
    if (estado.timer) clearTimeout(estado.timer);
  }
  await runWithTenantContext(empresaId, () =>
    prisma.whatsappCampaign.update({
      where: { id: campaignId },
      data: { status: "pausada" },
    })
  );
  await runWithTenantContext(empresaId, () =>
    prisma.whatsappCampaignContact.updateMany({
      where: { campaignId, status: "aguardando" },
      data: { status: "pausado" },
    })
  );
}

export async function continuarFilaCampanha(empresaId: string, campaignId: string) {
  await runWithTenantContext(empresaId, () =>
    prisma.whatsappCampaignContact.updateMany({
      where: { campaignId, status: "pausado" },
      data: { status: "aguardando" },
    })
  );
  await runWithTenantContext(empresaId, () =>
    prisma.whatsappCampaign.update({
      where: { id: campaignId },
      data: { status: "enviando" },
    })
  );
  await iniciarFilaCampanha(empresaId, campaignId);
}

export async function cancelarFilaCampanha(empresaId: string, campaignId: string) {
  const key = chaveFila(empresaId, campaignId);
  const estado = filasAtivas.get(key);
  if (estado) {
    estado.cancelado = true;
    estado.pausado = true;
    if (estado.timer) clearTimeout(estado.timer);
    filasAtivas.delete(key);
  }
  await runWithTenantContext(empresaId, () =>
    prisma.whatsappCampaign.update({
      where: { id: campaignId },
      data: { status: "cancelada", concluidoEm: new Date() },
    })
  );
  await runWithTenantContext(empresaId, () =>
    prisma.whatsappCampaignContact.updateMany({
      where: { campaignId, status: { in: ["aguardando", "pausado", "enviando"] } },
      data: { status: "cancelado" },
    })
  );
}

function pararFila(empresaId: string, campaignId: string) {
  const key = chaveFila(empresaId, campaignId);
  const estado = filasAtivas.get(key);
  if (estado?.timer) clearTimeout(estado.timer);
  filasAtivas.delete(key);
}

export async function retomarCampanhasPendentesServidor() {
  if (!baileysConfigurado()) return;
  const campanhas = await prisma.whatsappCampaign.findMany({
    where: { status: { in: ["enviando", "pausada"] } },
    select: { id: true, empresaId: true, status: true },
  });
  for (const c of campanhas) {
    if (c.status === "pausada") continue;
    void iniciarFilaCampanha(c.empresaId, c.id);
  }
}

export function campanhaEmExecucao(empresaId: string, campaignId: string) {
  return filasAtivas.has(chaveFila(empresaId, campaignId));
}
