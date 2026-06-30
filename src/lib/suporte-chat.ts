import { prisma } from "@/lib/db";
import { enviarEmailResend } from "@/lib/email-resend";

export type SuporteMensagemDto = {
  id: string;
  remetenteTipo: "usuario" | "suporte";
  remetenteNome: string;
  texto: string;
  lidaEm: string | null;
  createdAt: string;
};

export type SuporteConversaResumoDto = {
  empresaId: string;
  empresaNome: string;
  ultimaMensagemEm: string;
  ultimaMensagemTexto: string | null;
  naoLidas: number;
};

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
  return prisma.suporteConversa.upsert({
    where: { empresaId },
    create: { empresaId },
    update: {},
  });
}

function mapMensagem(m: {
  id: string;
  remetenteTipo: string;
  remetenteNome: string;
  texto: string;
  lidaEm: Date | null;
  createdAt: Date;
}): SuporteMensagemDto {
  return {
    id: m.id,
    remetenteTipo: m.remetenteTipo as "usuario" | "suporte",
    remetenteNome: m.remetenteNome,
    texto: m.texto,
    lidaEm: m.lidaEm?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
  };
}

export async function listarMensagensEmpresa(empresaId: string, marcarLidas = false) {
  const conversa = await garantirConversa(empresaId);

  if (marcarLidas) {
    await prisma.suporteMensagem.updateMany({
      where: {
        conversaId: conversa.id,
        remetenteTipo: "suporte",
        lidaEm: null,
      },
      data: { lidaEm: new Date() },
    });
  }

  const mensagens = await prisma.suporteMensagem.findMany({
    where: { conversaId: conversa.id },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return {
    conversaId: conversa.id,
    suporteEmail: rotuloSuportePlataforma(),
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
}) {
  const texto = params.texto.trim();
  if (!texto) throw new Error("TEXTO_VAZIO");

  const conversa = await garantirConversa(params.empresaId);
  const agora = new Date();

  const mensagem = await prisma.suporteMensagem.create({
    data: {
      conversaId: conversa.id,
      remetenteTipo: "usuario",
      remetenteUserId: params.userId,
      remetenteNome: params.userName,
      texto,
    },
  });

  await prisma.suporteConversa.update({
    where: { id: conversa.id },
    data: { ultimaMensagemEm: agora },
  });

  void notificarSuporteNovaMensagem({
    empresaNome: params.empresaNome,
    userName: params.userName,
    texto,
  });

  return mapMensagem(mensagem);
}

export async function listarConversasMaster() {
  const conversas = await prisma.suporteConversa.findMany({
    include: {
      empresa: { select: { id: true, nome: true } },
      mensagens: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { texto: true, createdAt: true },
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

  const lista: SuporteConversaResumoDto[] = conversas.map((c, i) => ({
    empresaId: c.empresaId,
    empresaNome: c.empresa.nome,
    ultimaMensagemEm: c.ultimaMensagemEm.toISOString(),
    ultimaMensagemTexto: c.mensagens[0]?.texto ?? null,
    naoLidas: naoLidasPorConversa[i] ?? 0,
  }));

  const totalNaoLidas = naoLidasPorConversa.reduce((s, n) => s + n, 0);

  return { conversas: lista, totalNaoLidas };
}

export async function listarMensagensMaster(empresaId: string, marcarLidas = false) {
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
}

export async function enviarMensagemSuporte(params: {
  empresaId: string;
  masterId: string;
  masterNome: string;
  texto: string;
}) {
  const texto = params.texto.trim();
  if (!texto) throw new Error("TEXTO_VAZIO");

  const conversa = await garantirConversa(params.empresaId);
  const agora = new Date();

  const mensagem = await prisma.suporteMensagem.create({
    data: {
      conversaId: conversa.id,
      remetenteTipo: "suporte",
      remetenteMasterId: params.masterId,
      remetenteNome: params.masterNome || rotuloSuportePlataforma(),
      texto,
    },
  });

  await prisma.suporteConversa.update({
    where: { id: conversa.id },
    data: { ultimaMensagemEm: agora },
  });

  return mapMensagem(mensagem);
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
