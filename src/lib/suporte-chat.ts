import type { SuporteConversaResumoDto, SuporteMensagemDto } from "@/lib/suporte-chat-types";
import { prisma } from "@/lib/db";
import { runWithRlsBypass } from "@/lib/prisma-tenant";
import { enviarEmailResend } from "@/lib/email-resend";
import { resumoTextoMensagemSuporte } from "@/lib/suporte-chat-anexo";
import { masterSuporteEstaOnline } from "@/lib/suporte/presenca-suporte-master";
import { conversaSuporteInativa } from "@/lib/suporte/suporte-inatividade";
import {
  emitSuporteConversaExpirada,
  emitSuporteConversasAtualizadas,
  emitSuporteNovaMensagem,
  emitSuporteNaoLidasEmpresa,
} from "@/lib/suporte/suporte-socket-server";

export type { SuporteConversaResumoDto, SuporteMensagemDto } from "@/lib/suporte-chat-types";

export function emailSuportePlataforma() {
  return (
    process.env.MASTER_ADMIN_EMAIL?.trim().toLowerCase() ||
    process.env.SUPORTE_EMAIL?.trim().toLowerCase() ||
    "admin@labprotese.com"
  );
}

export function rotuloSuportePlataforma() {
  return emailSuportePlataforma();
}

async function garantirConversa(empresaId: string) {
  await expirarConversaEmpresaSeInativa(empresaId);
  return prisma.suporteConversa.upsert({
    where: { empresaId },
    create: { empresaId },
    update: {},
  });
}

function idsArquivosDeMensagens(mensagens: Array<{ imagemUrl: string | null }>) {
  return mensagens
    .map((m) => m.imagemUrl?.match(/\/api\/uploads\/arquivo\/([^/?]+)/)?.[1])
    .filter((id): id is string => Boolean(id));
}

export async function excluirConversaSuporte(conversaId: string, empresaId: string) {
  const mensagens = await prisma.suporteMensagem.findMany({
    where: { conversaId },
    select: { imagemUrl: true },
  });
  const idsArquivos = idsArquivosDeMensagens(mensagens);

  await prisma.suporteConversa.delete({ where: { id: conversaId } });

  if (idsArquivos.length > 0) {
    await prisma.arquivoUpload.deleteMany({
      where: { id: { in: idsArquivos }, empresaId, pasta: "suporte" },
    });
  }
}

export async function expirarConversaEmpresaSeInativa(empresaId: string) {
  const conversa = await prisma.suporteConversa.findUnique({
    where: { empresaId },
    select: { id: true, ultimaMensagemEm: true },
  });
  if (!conversa || !conversaSuporteInativa(conversa.ultimaMensagemEm)) {
    return false;
  }

  await excluirConversaSuporte(conversa.id, empresaId);
  emitSuporteConversaExpirada(empresaId);
  emitSuporteConversasAtualizadas();
  return true;
}

export function suporteAdminEstaOnline() {
  return masterSuporteEstaOnline();
}

function mapMensagem(m: {
  id: string;
  remetenteTipo: string;
  remetenteNome: string;
  texto: string;
  imagemUrl?: string | null;
  lidaEm: Date | null;
  createdAt: Date;
}): SuporteMensagemDto {
  return {
    id: m.id,
    remetenteTipo: m.remetenteTipo as "usuario" | "suporte",
    remetenteNome: m.remetenteNome,
    texto: m.texto,
    imagemUrl: m.imagemUrl ?? null,
    lidaEm: m.lidaEm?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
  };
}

function validarConteudoMensagem(texto: string, imagemUrl?: string | null) {
  if (!texto.trim() && !imagemUrl) throw new Error("TEXTO_VAZIO");
  if (texto.length > 4000) throw new Error("TEXTO_LONGO");
}

async function publicarMensagemSuporte(empresaId: string, mensagem: SuporteMensagemDto) {
  emitSuporteNovaMensagem(empresaId, mensagem);
  emitSuporteConversasAtualizadas();

  if (mensagem.remetenteTipo === "suporte") {
    const naoLidas = await contarNaoLidasEmpresa(empresaId);
    emitSuporteNaoLidasEmpresa(empresaId, naoLidas);
  }
}

export async function listarMensagensEmpresa(empresaId: string, marcarLidas = false) {
  await expirarConversaEmpresaSeInativa(empresaId);

  const conversa = await prisma.suporteConversa.findUnique({
    where: { empresaId },
    select: { id: true },
  });

  if (!conversa) {
    return {
      conversaId: null,
      suporteEmail: rotuloSuportePlataforma(),
      suporteOnline: suporteAdminEstaOnline(),
      mensagens: [] as SuporteMensagemDto[],
    };
  }

  if (marcarLidas) {
    await prisma.suporteMensagem.updateMany({
      where: {
        conversaId: conversa.id,
        remetenteTipo: "suporte",
        lidaEm: null,
      },
      data: { lidaEm: new Date() },
    });
    emitSuporteNaoLidasEmpresa(empresaId, 0);
  }

  const mensagens = await prisma.suporteMensagem.findMany({
    where: { conversaId: conversa.id },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return {
    conversaId: conversa.id,
    suporteEmail: rotuloSuportePlataforma(),
    suporteOnline: suporteAdminEstaOnline(),
    mensagens: mensagens.map(mapMensagem),
  };
}

export async function contarNaoLidasEmpresa(empresaId: string) {
  const conversa = await prisma.suporteConversa.findUnique({
    where: { empresaId },
    select: { id: true },
  });
  if (!conversa) return 0;

  return prisma.suporteMensagem.count({
    where: {
      conversaId: conversa.id,
      remetenteTipo: "suporte",
      lidaEm: null,
    },
  });
}

export async function enviarMensagemUsuario(params: {
  empresaId: string;
  empresaNome: string;
  userId: string;
  userName: string;
  texto: string;
  imagemUrl?: string | null;
}) {
  if (!suporteAdminEstaOnline()) {
    throw new Error("SUPORTE_OFFLINE");
  }

  const texto = params.texto.trim();
  const imagemUrl = params.imagemUrl?.trim() || null;
  validarConteudoMensagem(texto, imagemUrl);

  const conversa = await garantirConversa(params.empresaId);
  const agora = new Date();

  const mensagem = await prisma.suporteMensagem.create({
    data: {
      conversaId: conversa.id,
      remetenteTipo: "usuario",
      remetenteUserId: params.userId,
      remetenteNome: params.userName,
      texto,
      imagemUrl,
    },
  });

  await prisma.suporteConversa.update({
    where: { id: conversa.id },
    data: { ultimaMensagemEm: agora },
  });

  const dto = mapMensagem(mensagem);
  await publicarMensagemSuporte(params.empresaId, dto);

  void notificarSuporteNovaMensagem({
    empresaNome: params.empresaNome,
    userName: params.userName,
    texto: resumoTextoMensagemSuporte(texto, imagemUrl),
  });

  return dto;
}

export async function listarConversasMaster() {
  return runWithRlsBypass(async () => {
    const conversas = await prisma.suporteConversa.findMany({
      include: {
        empresa: { select: { id: true, nome: true } },
        mensagens: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { texto: true, imagemUrl: true, createdAt: true },
        },
      },
      orderBy: { ultimaMensagemEm: "desc" },
    });

    const naoLidasPorConversa = await Promise.all(
      conversas.map((c) =>
        prisma.suporteMensagem.count({
          where: {
            conversaId: c.id,
            remetenteTipo: "usuario",
            lidaEm: null,
          },
        })
      )
    );

    const lista: SuporteConversaResumoDto[] = conversas.map((c, i) => {
      const ultima = c.mensagens[0];
      return {
        empresaId: c.empresaId,
        empresaNome: c.empresa.nome,
        ultimaMensagemEm: c.ultimaMensagemEm.toISOString(),
        ultimaMensagemTexto: ultima
          ? resumoTextoMensagemSuporte(ultima.texto, ultima.imagemUrl)
          : null,
        naoLidas: naoLidasPorConversa[i] ?? 0,
      };
    });

    const totalNaoLidas = naoLidasPorConversa.reduce((s, n) => s + n, 0);

    return { conversas: lista, totalNaoLidas };
  });
}

export async function listarMensagensMaster(empresaId: string, marcarLidas = false) {
  return runWithRlsBypass(async () => {
    await expirarConversaEmpresaSeInativa(empresaId);

    const conversa = await prisma.suporteConversa.findUnique({
      where: { empresaId },
      include: {
        empresa: { select: { id: true, nome: true } },
      },
    });

    if (!conversa) {
      return {
        conversaId: null,
        empresaId,
        empresaNome: "",
        mensagens: [] as SuporteMensagemDto[],
      };
    }

    if (marcarLidas) {
      await prisma.suporteMensagem.updateMany({
        where: {
          conversaId: conversa.id,
          remetenteTipo: "usuario",
          lidaEm: null,
        },
        data: { lidaEm: new Date() },
      });
      emitSuporteConversasAtualizadas();
    }

    const mensagens = await prisma.suporteMensagem.findMany({
      where: { conversaId: conversa.id },
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    return {
      conversaId: conversa.id,
      empresaId: conversa.empresaId,
      empresaNome: conversa.empresa.nome,
      mensagens: mensagens.map(mapMensagem),
    };
  });
}

export async function enviarMensagemSuporte(params: {
  empresaId: string;
  masterId: string;
  masterNome: string;
  texto: string;
  imagemUrl?: string | null;
}) {
  return runWithRlsBypass(async () => {
    const texto = params.texto.trim();
    const imagemUrl = params.imagemUrl?.trim() || null;
    validarConteudoMensagem(texto, imagemUrl);

    const conversa = await garantirConversa(params.empresaId);
    const agora = new Date();

    const mensagem = await prisma.suporteMensagem.create({
      data: {
        conversaId: conversa.id,
        remetenteTipo: "suporte",
        remetenteMasterId: params.masterId,
        remetenteNome: params.masterNome || rotuloSuportePlataforma(),
        texto,
        imagemUrl,
      },
    });

    await prisma.suporteConversa.update({
      where: { id: conversa.id },
      data: { ultimaMensagemEm: agora },
    });

    const dto = mapMensagem(mensagem);
    await publicarMensagemSuporte(params.empresaId, dto);

    return dto;
  });
}

async function notificarSuporteNovaMensagem(params: {
  empresaNome: string;
  userName: string;
  texto: string;
}) {
  const destino = emailSuportePlataforma();
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.URL_PUBLICA_DO_APP?.trim() ||
    "https://www.denteartlab.com.br";

  await enviarEmailResend({
    to: destino,
    subject: `[Suporte] Nova mensagem — ${params.empresaNome}`,
    html: `
      <p><strong>${params.userName}</strong> (${params.empresaNome}) enviou uma mensagem no chat de suporte:</p>
      <blockquote style="border-left:3px solid #4a90d9;padding-left:12px;margin:16px 0;color:#334155;">
        ${params.texto.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}
      </blockquote>
      <p><a href="${appUrl}/admin-master/suporte">Abrir painel de suporte</a></p>
    `,
    text: `${params.userName} (${params.empresaNome}): ${params.texto}\n\nAbrir: ${appUrl}/admin-master/suporte`,
  });
}

export async function parseCorpoMensagemSuporte(
  request: Request,
  empresaId: string
): Promise<{ texto: string; imagemUrl?: string | null }> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const { salvarImagemSuporteChat } = await import("@/lib/suporte-chat-anexo");
    const formData = await request.formData();
    const texto = String(formData.get("texto") ?? "").trim();
    const arquivo = formData.get("imagem");
    let imagemUrl: string | null = null;

    if (arquivo instanceof File && arquivo.size > 0) {
      imagemUrl = await salvarImagemSuporteChat(arquivo, empresaId);
    }

    return { texto, imagemUrl };
  }

  const body = (await request.json()) as { texto?: string; imagemUrl?: string };
  return {
    texto: (body.texto ?? "").trim(),
    imagemUrl: body.imagemUrl?.trim() || null,
  };
}

export function respostaErroMensagemSuporte(erro: unknown) {
  const msg = erro instanceof Error ? erro.message : "Erro ao enviar";
  if (msg === "TEXTO_VAZIO") {
    return { status: 400, error: "Digite uma mensagem ou envie uma imagem." };
  }
  if (msg === "TEXTO_LONGO") {
    return { status: 400, error: "Mensagem muito longa (máx. 4000 caracteres)." };
  }
  if (msg === "IMAGEM_GRANDE") {
    return { status: 400, error: "Imagem muito grande (máx. 2 MB)." };
  }
  if (msg === "TIPO_INVALIDO") {
    return { status: 400, error: "Envie apenas imagens (JPEG, PNG, WebP ou GIF)." };
  }
  if (msg === "SUPORTE_OFFLINE") {
    return {
      status: 503,
      error: "O suporte está offline no momento. Tente novamente quando houver atendente disponível.",
    };
  }
  return { status: 500, error: "Erro ao enviar mensagem." };
}
