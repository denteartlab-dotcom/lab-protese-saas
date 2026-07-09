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
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.WHATSAPP_BAILEYS_PORT || 3100);
const TOKEN = (process.env.WHATSAPP_HTTP_TOKEN || "").trim();
const AUTH_DIR =
  process.env.WHATSAPP_AUTH_DIR ||
  path.join(path.resolve(__dirname, ".."), "data", "whatsapp-auth");

const MAX_AUTO_RECONNECT = 6;
const QR_LOG_INTERVAL_MS = 25_000;

let sock = null;
let qrAtual = null;
let conectado = false;
let iniciando = false;
let numeroConectado = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let reconnectEmAndamento = false;
let bootWatchdogFeito = false;
let ultimoQrLogEm = 0;
let ultimoQrHash = null;
let qrGeradoEm = null;

function log(...args) {
  console.log("[whatsapp-baileys]", ...args);
}

function hashQr(qr) {
  return qr ? qr.slice(-24) : null;
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

function cancelarReconnectAgendado() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function resetarEstadoConectado() {
  conectado = false;
  numeroConectado = null;
}

function registrarQr(qr) {
  qrAtual = qr;
  qrGeradoEm = Date.now();
  const h = hashQr(qr);
  const agora = Date.now();
  if (h !== ultimoQrHash || agora - ultimoQrLogEm > QR_LOG_INTERVAL_MS) {
    ultimoQrHash = h;
    ultimoQrLogEm = agora;
    log("QR Code disponível — escaneie no WhatsApp (Aparelhos conectados). Válido ~60s.");
  }
}

async function encerrarSocket() {
  if (sock) {
    try {
      sock.ev.removeAllListeners();
    } catch {
      /* ignora */
    }
    try {
      await sock.end(undefined);
    } catch {
      /* ignora */
    }
    sock = null;
  }
  iniciando = false;
}

function qrRecente() {
  return Boolean(qrAtual && qrGeradoEm && Date.now() - qrGeradoEm < 55_000);
}

function agendarReconnect(motivo, delayMs, opts = { limparAuth: false }) {
  if (conectado || reconnectTimer || reconnectEmAndamento) return;
  if (reconnectAttempts >= MAX_AUTO_RECONNECT) {
    log(
      `Auto-reconnect pausado (${reconnectAttempts} tentativas). Clique em Gerar QR Code no site ou pm2 restart lab-protese-whatsapp.`
    );
    return;
  }

  reconnectAttempts += 1;
  const delay = Math.min(Math.round(delayMs * Math.pow(1.4, reconnectAttempts - 1)), 60_000);
  log(`Reconnect agendado em ${Math.round(delay / 1000)}s (${motivo}) — tentativa ${reconnectAttempts}/${MAX_AUTO_RECONNECT}`);

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void reiniciarConexao(opts);
  }, delay);
}

async function aguardarQrLocal(maxMs = 50_000) {
  const inicio = Date.now();
  while (Date.now() - inicio < maxMs) {
    if (conectado) return { connected: true, qr: null, phone: numeroConectado };
    if (qrAtual) return { connected: false, qr: qrAtual, phone: null };
    await new Promise((r) => setTimeout(r, 800));
  }
  return { connected: conectado, qr: qrAtual || null, phone: numeroConectado };
}

async function reiniciarConexao(opts = { limparAuth: false }) {
  if (reconnectEmAndamento) {
    return aguardarQrLocal(15_000);
  }

  if (!opts.limparAuth && conectado) {
    return { connected: true, qr: null, phone: numeroConectado };
  }

  if (!opts.limparAuth && qrRecente()) {
    log("QR recente ainda válido — mantendo sessão atual.");
    return { connected: false, qr: qrAtual, phone: null };
  }

  reconnectEmAndamento = true;
  cancelarReconnectAgendado();

  try {
    await encerrarSocket();
    resetarEstadoConectado();
    qrAtual = null;
    qrGeradoEm = null;
    ultimoQrHash = null;

    if (opts.limparAuth) {
      limparAuthDir();
      reconnectAttempts = 0;
      log("Sessão anterior removida — novo QR será gerado.");
    }

    await conectar();
    return aguardarQrLocal(opts.limparAuth ? 50_000 : 25_000);
  } finally {
    reconnectEmAndamento = false;
  }
}

function limparAuthDir() {
  try {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  } catch {
    /* ignora */
  }
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

function tratarFechamentoConexao(lastDisconnect) {
  resetarEstadoConectado();
  qrAtual = null;
  qrGeradoEm = null;

  const statusCode = lastDisconnect?.error?.output?.statusCode;
  const loggedOut = statusCode === DisconnectReason.loggedOut;
  const badSession = statusCode === DisconnectReason.badSession;
  const replaced = statusCode === DisconnectReason.connectionReplaced;
  const restartRequired = statusCode === DisconnectReason.restartRequired;
  const msg = lastDisconnect?.error?.message || "";

  if (loggedOut || badSession) {
    log("Sessão inválida — será gerado novo QR após limpar credenciais.");
    reconnectAttempts = 0;
    agendarReconnect("sessao-invalida", 8000, { limparAuth: true });
    return;
  }

  if (replaced) {
    log("WhatsApp conectado em outro aparelho/sessão — reconexão manual necessária.");
    reconnectAttempts = MAX_AUTO_RECONNECT;
    return;
  }

  if (restartRequired) {
    agendarReconnect("restart-required", 5000, { limparAuth: false });
    return;
  }

  log("Conexão fechada.", msg || "Reconectando com backoff…");
  agendarReconnect("close", 12_000, { limparAuth: false });
}

async function conectar() {
  if (iniciando || conectado || sock) return;
  iniciando = true;

  try {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));

    sock = makeWASocket({
      auth: state,
      version,
      logger: pino({ level: "warn" }),
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      browser: ["Lab Protese SaaS", "Chrome", "120.0.0"],
      connectTimeoutMs: 60_000,
      defaultQueryTimeoutMs: 60_000,
      keepAliveIntervalMs: 30_000,
      qrTimeout: 60_000,
    });

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        registrarQr(qr);
      }

      if (connection) {
        log("Estado:", connection);
      }

      if (connection === "open") {
        conectado = true;
        qrAtual = null;
        qrGeradoEm = null;
        ultimoQrHash = null;
        reconnectAttempts = 0;
        cancelarReconnectAgendado();
        numeroConectado = extrairNumeroUsuario(sock);
        log("Conectado ao WhatsApp.", numeroConectado || "");
      }

      if (connection === "close") {
        void encerrarSocket().then(() => {
          tratarFechamentoConexao(lastDisconnect);
        });
      }
    });
  } catch (err) {
    log("Erro ao iniciar:", err);
    sock = null;
    agendarReconnect("erro-boot", 15_000, { limparAuth: false });
  } finally {
    iniciando = false;
  }
}

async function enviarMensagem(phone, message) {
  if (!sock || !conectado) {
    throw new Error("WhatsApp não conectado. Escaneie o QR Code em Disparos WhatsApp.");
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
  cancelarReconnectAgendado();
  reconnectAttempts = 0;

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
  qrGeradoEm = null;
  iniciando = false;
  limparAuthDir();
  setTimeout(() => void conectar(), 3000);
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
        iniciando,
        hasSocket: Boolean(sock),
        reconnectAttempts,
        qrRecente: qrRecente(),
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
      let body = {};
      try {
        body = await lerJson(req);
      } catch {
        body = {};
      }

      if (conectado) {
        return json(res, 200, {
          ok: true,
          connected: true,
          qr: null,
          phone: numeroConectado,
        });
      }

      const limparAuth = Boolean(body.limparAuth || body.limparSessao);
      const aguardado = await reiniciarConexao({ limparAuth });
      return json(res, 200, {
        ok: true,
        connected: aguardado.connected,
        qr: aguardado.qr,
        phone: aguardado.phone,
      });
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

  setTimeout(async () => {
    if (bootWatchdogFeito || conectado || qrAtual || sock) return;
    bootWatchdogFeito = true;
    log("Boot: sem QR após 45s — tentando reconectar sem apagar sessão…");
    await reiniciarConexao({ limparAuth: false });
  }, 45_000);

  setTimeout(async () => {
    if (conectado || qrAtual) return;
    if (reconnectAttempts >= MAX_AUTO_RECONNECT) return;
    log("Boot: ainda sem QR após 2 min — limpando sessão antiga (último recurso)…");
    await reiniciarConexao({ limparAuth: true });
  }, 120_000);
});
