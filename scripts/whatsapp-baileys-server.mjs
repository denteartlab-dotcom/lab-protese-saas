/**
 * Microserviço HTTP para envio de WhatsApp via Baileys.
 * Rode com PM2 ao lado do lab-protese (ver deploy/ecosystem.config.cjs).
 */
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import pino from "pino";
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.WHATSAPP_BAILEYS_PORT || 3100);
const TOKEN = (process.env.WHATSAPP_HTTP_TOKEN || "").trim();
const AUTH_DIR =
  process.env.WHATSAPP_AUTH_DIR ||
  path.join(path.resolve(__dirname, ".."), "data", "whatsapp-auth");
const LOCK_FILE = path.join(AUTH_DIR, ".baileys.lock");

const logger = pino({ level: "warn" });

let sock = null;
let qrAtual = null;
let conectado = false;
let iniciando = false;
let numeroConectado = null;
let credenciaisRegistradas = false;
let reconnectTimer = null;
let reconnectAttempts = 0;
let ultimoQrLogEm = 0;
let ultimoQrHash = null;
let qrGeradoEm = null;
let saveCredsFn = null;

function log(...args) {
  console.log("[whatsapp-baileys]", ...args);
}

function garantirInstanciaUnica() {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  try {
    fs.writeFileSync(LOCK_FILE, String(process.pid), { flag: "wx" });
  } catch {
    try {
      const pid = Number(fs.readFileSync(LOCK_FILE, "utf8").trim());
      if (pid && pid !== process.pid) {
        try {
          process.kill(pid, 0);
          log(`ERRO: outro Baileys já roda (PID ${pid}). Pare duplicatas: pm2 delete lab-protese-whatsapp && pm2 start deploy/ecosystem.config.cjs --only lab-protese-whatsapp`);
          process.exit(1);
        } catch {
          fs.unlinkSync(LOCK_FILE);
          fs.writeFileSync(LOCK_FILE, String(process.pid), { flag: "wx" });
        }
      }
    } catch {
      fs.writeFileSync(LOCK_FILE, String(process.pid));
    }
  }

  const liberarLock = () => {
    try {
      if (fs.readFileSync(LOCK_FILE, "utf8").trim() === String(process.pid)) {
        fs.unlinkSync(LOCK_FILE);
      }
    } catch {
      /* ignora */
    }
  };
  process.on("exit", liberarLock);
  process.on("SIGINT", () => {
    liberarLock();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    liberarLock();
    process.exit(0);
  });
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

function limparAuthDir() {
  try {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  } catch {
    /* ignora */
  }
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  try {
    fs.writeFileSync(LOCK_FILE, String(process.pid));
  } catch {
    /* ignora */
  }
  credenciaisRegistradas = false;
}

function registrarQr(qr) {
  qrAtual = qr;
  qrGeradoEm = Date.now();
  const h = qr.slice(-24);
  const agora = Date.now();
  if (h !== ultimoQrHash || agora - ultimoQrLogEm > 30_000) {
    ultimoQrHash = h;
    ultimoQrLogEm = agora;
    log("QR disponível — escaneie UMA vez e aguarde até 30s (não clique de novo).");
  }
}

function limparSocketLocal() {
  if (sock) {
    try {
      sock.ev.removeAllListeners();
    } catch {
      /* ignora */
    }
  }
  sock = null;
  iniciando = false;
}

function qrRecente() {
  return Boolean(qrAtual && qrGeradoEm && Date.now() - qrGeradoEm < 50_000);
}

function agendarReconnect(motivo, delayMs) {
  if (conectado || reconnectTimer || iniciando) return;
  if (reconnectAttempts >= 5) {
    log(`Reconnect pausado (${reconnectAttempts}x). Rode: npm run whatsapp:reset`);
    return;
  }
  reconnectAttempts += 1;
  const delay = Math.min(delayMs * reconnectAttempts, 45_000);
  log(`Reconnect em ${Math.round(delay / 1000)}s (${motivo})`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void startBaileys();
  }, delay);
}

async function aguardarQrLocal(maxMs = 45_000) {
  const inicio = Date.now();
  while (Date.now() - inicio < maxMs) {
    if (conectado) return { connected: true, qr: null, phone: numeroConectado };
    if (qrAtual) return { connected: false, qr: qrAtual, phone: null };
    await new Promise((r) => setTimeout(r, 700));
  }
  return { connected: conectado, qr: qrAtual || null, phone: numeroConectado };
}

function tratarFechamento(lastDisconnect) {
  conectado = false;
  numeroConectado = null;
  limparSocketLocal();

  const statusCode = lastDisconnect?.error?.output?.statusCode;
  const msg = lastDisconnect?.error?.message || "";

  if (statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.badSession) {
    log("Sessão inválida — limpando credenciais.", msg);
    credenciaisRegistradas = false;
    qrAtual = null;
    qrGeradoEm = null;
    reconnectAttempts = 0;
    limparAuthDir();
    agendarReconnect("sessao-invalida", 5000);
    return;
  }

  if (statusCode === DisconnectReason.connectionReplaced) {
    log("WhatsApp aberto em outro lugar — pare outras sessões Baileys.");
    reconnectAttempts = 5;
    return;
  }

  if (statusCode === DisconnectReason.restartRequired) {
    log("Pareamento OK — reconectando imediatamente (sem novo QR)…");
    reconnectAttempts = 0;
    qrAtual = null;
    qrGeradoEm = null;
    cancelarReconnectAgendado();
    void startBaileys();
    return;
  }

  log("Conexão fechada.", msg || `code=${statusCode ?? "?"}`);
  agendarReconnect("close", 15_000);
}

async function startBaileys() {
  if (conectado) return;
  if (iniciando) return;
  if (sock) return;

  cancelarReconnectAgendado();
  iniciando = true;

  try {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    saveCredsFn = saveCreds;
    credenciaisRegistradas = Boolean(state.creds?.registered);

    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));

    sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      version,
      logger,
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      browser: ["Lab Protese", "Chrome", "120.0.0"],
      connectTimeoutMs: 60_000,
      defaultQueryTimeoutMs: 60_000,
      keepAliveIntervalMs: 30_000,
      qrTimeout: 60_000,
      getMessage: async () => undefined,
    });

    sock.ev.on("creds.update", async () => {
      await saveCreds();
      if (state.creds?.registered) {
        credenciaisRegistradas = true;
        qrAtual = null;
        qrGeradoEm = null;
      }
    });

    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        if (conectado || credenciaisRegistradas) {
          return;
        }
        registrarQr(qr);
      }

      if (connection === "connecting") {
        log("Conectando…");
      }

      if (connection === "open") {
        conectado = true;
        credenciaisRegistradas = true;
        qrAtual = null;
        qrGeradoEm = null;
        reconnectAttempts = 0;
        cancelarReconnectAgendado();
        numeroConectado = extrairNumeroUsuario(sock);
        log("Conectado ao WhatsApp.", numeroConectado || "");
      }

      if (connection === "close") {
        tratarFechamento(lastDisconnect);
      }
    });
  } catch (err) {
    log("Erro ao iniciar Baileys:", err);
    limparSocketLocal();
    agendarReconnect("erro-boot", 10_000);
  } finally {
    iniciando = false;
  }
}

async function resetarSessaoCompleta() {
  cancelarReconnectAgendado();
  reconnectAttempts = 0;
  conectado = false;
  numeroConectado = null;
  qrAtual = null;
  qrGeradoEm = null;
  credenciaisRegistradas = false;

  if (sock) {
    try {
      await sock.logout();
    } catch {
      /* ignora */
    }
  }
  limparSocketLocal();
  limparAuthDir();
  await startBaileys();
  return aguardarQrLocal(50_000);
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

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);

    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, { ok: true });
    }

    if (req.method === "GET" && url.pathname === "/status") {
      return json(res, 200, {
        connected: conectado,
        qr: conectado ? null : qrAtual || null,
        phone: numeroConectado,
        authDir: AUTH_DIR,
        iniciando,
        hasSocket: Boolean(sock),
        credenciaisRegistradas,
        reconnectAttempts,
        pareamentoEmAndamento: credenciaisRegistradas && !conectado,
      });
    }

    if (url.pathname === "/send" && req.method === "POST") {
      if (!autorizado(req)) return json(res, 401, { ok: false, error: "Não autorizado" });
      const body = await lerJson(req);
      await enviarMensagem(body.phone || body.telefone, body.message || body.mensagem);
      return json(res, 200, { ok: true });
    }

    if (url.pathname === "/send-media" && req.method === "POST") {
      if (!autorizado(req)) return json(res, 401, { ok: false, error: "Não autorizado" });
      const body = await lerJson(req);
      await enviarMidia(body.phone || body.telefone, body);
      return json(res, 200, { ok: true });
    }

    if (url.pathname === "/logout" && req.method === "POST") {
      if (!autorizado(req)) return json(res, 401, { ok: false, error: "Não autorizado" });
      await resetarSessaoCompleta();
      return json(res, 200, { ok: true });
    }

    if (url.pathname === "/reconnect" && req.method === "POST") {
      if (!autorizado(req)) return json(res, 401, { ok: false, error: "Não autorizado" });

      let body = {};
      try {
        body = await lerJson(req);
      } catch {
        body = {};
      }

      if (conectado) {
        return json(res, 200, { ok: true, connected: true, qr: null, phone: numeroConectado });
      }

      if (credenciaisRegistradas && !conectado) {
        log("Pareamento em andamento — aguardando reconexão automática…");
        if (!sock && !iniciando) void startBaileys();
        const aguardado = await aguardarQrLocal(35_000);
        return json(res, 200, {
          ok: true,
          connected: aguardado.connected,
          qr: aguardado.qr,
          phone: aguardado.phone,
          pareamentoEmAndamento: !aguardado.connected && !aguardado.qr,
        });
      }

      if (qrRecente()) {
        return json(res, 200, {
          ok: true,
          connected: false,
          qr: qrAtual,
          phone: null,
        });
      }

      const limparAuth = Boolean(body.limparAuth || body.limparSessao);
      if (limparAuth) {
        const aguardado = await resetarSessaoCompleta();
        return json(res, 200, {
          ok: true,
          connected: aguardado.connected,
          qr: aguardado.qr,
          phone: aguardado.phone,
        });
      }

      if (!sock && !iniciando) {
        void startBaileys();
      }

      const aguardado = await aguardarQrLocal(45_000);
      return json(res, 200, {
        ok: true,
        connected: aguardado.connected,
        qr: aguardado.qr,
        phone: aguardado.phone,
      });
    }

    json(res, 404, { ok: false, error: "Rota não encontrada" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    json(res, 422, { ok: false, error: msg });
  }
});

garantirInstanciaUnica();
server.listen(PORT, "127.0.0.1", () => {
  log(`HTTP em http://127.0.0.1:${PORT} (auth: ${AUTH_DIR})`);
  void startBaileys();
});
