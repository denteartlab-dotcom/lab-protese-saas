/**
 * Microserviço HTTP para envio de WhatsApp via Baileys.
 * Rode com PM2 ao lado do lab-protese (ver deploy/ecosystem.config.cjs).
 *
 * POST /send  { phone, message }  — compatível com WHATSAPP_HTTP_URL do Lab Prótese
 * GET  /status — { connected, qr? }
 * GET  /health
 */
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import pino from "pino";
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.WHATSAPP_BAILEYS_PORT || 3100);
const TOKEN = (process.env.WHATSAPP_HTTP_TOKEN || "").trim();
const AUTH_DIR =
  process.env.WHATSAPP_AUTH_DIR ||
  path.join(path.resolve(__dirname, ".."), "data", "whatsapp-auth");

let sock = null;
let qrAtual = null;
let conectado = false;
let iniciando = false;
let numeroConectado = null;

function log(...args) {
  console.log("[whatsapp-baileys]", ...args);
}

function extrairNumeroUsuario(sockInst) {
  const id = sockInst?.user?.id || "";
  const digits = String(id).replace(/@.*/, "").replace(/\D/g, "");
  return digits || null;
}

function jidFromPhone(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith("55")) {
    digits = `55${digits}`;
  }
  return `${digits}@s.whatsapp.net`;
}

function lerJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function autorizado(req) {
  if (!TOKEN) return true;
  const header = req.headers.authorization || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return bearer === TOKEN;
}

async function conectar() {
  if (iniciando) return;
  iniciando = true;
  try {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    sock = makeWASocket({
      auth: state,
      logger: pino({ level: "warn" }),
      printQRInTerminal: true,
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        qrAtual = qr;
        log("Escaneie o QR Code no WhatsApp (Aparelhos conectados).");
      }
      if (connection === "open") {
        conectado = true;
        qrAtual = null;
        numeroConectado = extrairNumeroUsuario(sock);
        log("Conectado ao WhatsApp.", numeroConectado || "");
      }
      if (connection === "close") {
        conectado = false;
        numeroConectado = null;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;
        log("Conexão fechada.", loggedOut ? "Sessão encerrada — escaneie o QR novamente." : "Reconectando…");
        sock = null;
        iniciando = false;
        if (!loggedOut) {
          setTimeout(() => void conectar(), 4000);
        }
      }
    });
  } catch (err) {
    log("Erro ao iniciar:", err);
    sock = null;
    iniciando = false;
    setTimeout(() => void conectar(), 8000);
  }
}

async function enviarMensagem(phone, message) {
  if (!sock || !conectado) {
    throw new Error("WhatsApp não conectado. Escaneie o QR Code em Configurações → WhatsApp.");
  }
  const jid = jidFromPhone(phone);
  if (!jid) throw new Error("Telefone inválido.");
  const texto = String(message || "").trim();
  if (!texto) throw new Error("Mensagem vazia.");
  await sock.sendMessage(jid, { text: texto });
  return { ok: true };
}

async function enviarMidia(phone, body) {
  if (!sock || !conectado) {
    throw new Error("WhatsApp não conectado. Escaneie o QR Code.");
  }
  const jid = jidFromPhone(phone);
  if (!jid) throw new Error("Telefone inválido.");

  const buffer = Buffer.from(String(body.dataBase64 || ""), "base64");
  if (!buffer.length) throw new Error("Arquivo vazio.");

  const caption = String(body.message || "").trim();
  const tipo = String(body.tipo || "documento");
  const mimeType = String(body.mimeType || "application/octet-stream");
  const fileName = String(body.fileName || "arquivo");

  let content;
  if (tipo === "imagem") {
    content = { image: buffer, caption: caption || undefined, mimetype: mimeType };
  } else if (tipo === "video") {
    content = { video: buffer, caption: caption || undefined, mimetype: mimeType };
  } else if (tipo === "audio") {
    content = { audio: buffer, mimetype: mimeType, ptt: false };
  } else {
    content = {
      document: buffer,
      mimetype: mimeType,
      fileName,
      caption: caption || undefined,
    };
  }

  await sock.sendMessage(jid, content);
  return { ok: true };
}

async function desconectar() {
  if (sock) {
    try {
      await sock.logout();
    } catch {
      /* ignora */
    }
    sock = null;
  }
  conectado = false;
  numeroConectado = null;
  qrAtual = null;
  iniciando = false;
  try {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  } catch {
    /* ignora */
  }
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  setTimeout(() => void conectar(), 1500);
  return { ok: true };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);

    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, { ok: true });
    }

    if (req.method === "GET" && url.pathname === "/status") {
      return json(res, 200, {
        connected: conectado,
        qr: qrAtual || null,
        phone: numeroConectado,
        authDir: AUTH_DIR,
      });
    }

    if (url.pathname === "/send" && req.method === "POST") {
      if (!autorizado(req)) {
        return json(res, 401, { ok: false, error: "Não autorizado" });
      }
      const body = await lerJson(req);
      const phone = body.phone || body.telefone;
      const message = body.message || body.mensagem;
      await enviarMensagem(phone, message);
      return json(res, 200, { ok: true });
    }

    if (url.pathname === "/send-media" && req.method === "POST") {
      if (!autorizado(req)) {
        return json(res, 401, { ok: false, error: "Não autorizado" });
      }
      const body = await lerJson(req);
      const phone = body.phone || body.telefone;
      await enviarMidia(phone, body);
      return json(res, 200, { ok: true });
    }

    if (url.pathname === "/logout" && req.method === "POST") {
      if (!autorizado(req)) {
        return json(res, 401, { ok: false, error: "Não autorizado" });
      }
      await desconectar();
      return json(res, 200, { ok: true });
    }

    if (url.pathname === "/reconnect" && req.method === "POST") {
      if (!autorizado(req)) {
        return json(res, 401, { ok: false, error: "Não autorizado" });
      }
      if (!iniciando && !conectado) void conectar();
      return json(res, 200, { ok: true });
    }

    json(res, 404, { ok: false, error: "Rota não encontrada" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao enviar mensagem";
    json(res, 422, { ok: false, error: msg });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  log(`HTTP em http://127.0.0.1:${PORT} (auth: ${AUTH_DIR})`);
  void conectar();
});
