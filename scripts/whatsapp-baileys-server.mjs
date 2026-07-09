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
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  proto,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.WHATSAPP_BAILEYS_PORT || 3100);
const TOKEN = (process.env.WHATSAPP_HTTP_TOKEN || "").trim();
const AUTH_DIR =
  process.env.WHATSAPP_AUTH_DIR ||
  path.join(path.resolve(__dirname, ".."), "data", "whatsapp-auth");
const LOCK_FILE = path.join(AUTH_DIR, ".baileys.lock");
const COOLDOWN_FILE = path.join(path.dirname(AUTH_DIR), "whatsapp-pairing-cooldown.json");
const COOLDOWN_PADRAO_HORAS = Number(process.env.WHATSAPP_PAIRING_COOLDOWN_HORAS || 24);

function marcarSessaoInstavel(motivo) {
  if (!conectado && !sock) return;
  prontoParaEnvio = false;
  rejeitarPendentesAck("Sessão WhatsApp instável — aguarde e tente de novo.");
  log(`Sessão instável (${motivo}) — aguardando ${WARMUP_MS / 1000}s antes de novos envios.`);
  if (conectado && sock?.user?.id) {
    agendarWarmupEnvio();
  }
}

function criarLoggerBaileys() {
  return pino({
    level: "warn",
    hooks: {
      logMethod(args, method) {
        const obj = args.find((a) => a && typeof a === "object" && !Array.isArray(a));
        const msg = typeof args[0] === "string" ? args[0] : obj?.msg;
        if (
          msg === "received error in ack" ||
          msg === "error in sending keep alive" ||
          msg === "stream errored out" ||
          msg === "unexpected error in 'init queries'"
        ) {
          marcarSessaoInstavel(String(msg));
        }
        return method.apply(this, args);
      },
    },
  });
}

const logger = criarLoggerBaileys();

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
let pairingCodeAtual = null;
let pairingPhoneAlvo = null;
let pairingCodeSolicitado = false;
let conectadoEm = null;
let prontoParaEnvio = false;
let warmupTimer = null;
let falhasConexaoSeguidas = 0;

const ACK_TIMEOUT_MS = Number(process.env.WHATSAPP_ACK_TIMEOUT_MS || 12_000);
const WARMUP_MS = Number(process.env.WHATSAPP_WARMUP_MS || 12_000);
const ENVIO_TIMEOUT_MS = Number(process.env.WHATSAPP_ENVIO_TIMEOUT_MS || 38_000);
const pendentesAck = new Map();
let filaEnvio = Promise.resolve();

const StatusMensagem = proto.WebMessageInfo.Status;

function browserWhatsApp() {
  const modo = (process.env.WHATSAPP_BROWSER || "windows").toLowerCase();
  if (modo === "macos" || modo === "mac") return Browsers.macOS("Chrome");
  if (modo === "ubuntu") return Browsers.ubuntu("Chrome");
  return Browsers.windows("Chrome");
}

function formatarCodigoPareamento(code) {
  if (!code) return null;
  const limpo = String(code).replace(/\D/g, "");
  return limpo.match(/.{1,4}/g)?.join("-") || limpo;
}

function normalizarTelefonePareamento(raw) {
  let digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return null;
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith("55")) {
    digits = `55${digits}`;
  }
  if (digits.length < 12 || digits.length > 13) return null;
  return digits;
}

function lerCooldown() {
  try {
    const data = JSON.parse(fs.readFileSync(COOLDOWN_FILE, "utf8"));
    const untilMs = new Date(data.until).getTime();
    if (untilMs > Date.now()) {
      return { active: true, until: data.until, reason: data.reason || "bloqueio" };
    }
    fs.unlinkSync(COOLDOWN_FILE);
  } catch {
    /* sem cooldown */
  }
  return { active: false };
}

function ativarCooldown(motivo, horas = COOLDOWN_PADRAO_HORAS) {
  const until = new Date(Date.now() + horas * 60 * 60 * 1000).toISOString();
  fs.mkdirSync(path.dirname(COOLDOWN_FILE), { recursive: true });
  fs.writeFileSync(
    COOLDOWN_FILE,
    JSON.stringify({ until, reason: motivo, at: new Date().toISOString(), horas }, null, 2)
  );
  cancelarReconnectAgendado();
  limparSocketLocal();
  qrAtual = null;
  qrGeradoEm = null;
  reconnectAttempts = 5;
  log(`PAREAMENTO PAUSADO por ${horas}h (${motivo}). WhatsApp bloqueou novos dispositivos — aguarde.`);
}

function limparCooldown() {
  try {
    fs.unlinkSync(COOLDOWN_FILE);
  } catch {
    /* ignora */
  }
}

function pareamentoBloqueado() {
  return lerCooldown().active;
}

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

function variantesTelefoneBr(raw) {
  let digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return [];
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith("55")) {
    digits = `55${digits}`;
  }
  const set = new Set([digits]);
  if (digits.startsWith("55") && digits.length === 13) {
    const ddd = digits.slice(2, 4);
    const num = digits.slice(4);
    if (num.length === 9 && num[0] === "9") {
      set.add(`55${ddd}${num.slice(1)}`);
    }
  }
  if (digits.startsWith("55") && digits.length === 12) {
    const ddd = digits.slice(2, 4);
    const num = digits.slice(4);
    if (num.length === 8) {
      set.add(`55${ddd}9${num}`);
    }
  }
  return [...set];
}

function conexaoEnvioOk() {
  return Boolean(sock && conectado && prontoParaEnvio && sock.user?.id && !iniciando);
}

function segundosWarmupRestantes() {
  if (prontoParaEnvio || !conectadoEm) return 0;
  return Math.max(0, Math.ceil((WARMUP_MS - (Date.now() - conectadoEm)) / 1000));
}

function agendarWarmupEnvio() {
  prontoParaEnvio = false;
  conectadoEm = Date.now();
  if (warmupTimer) clearTimeout(warmupTimer);
  warmupTimer = setTimeout(() => {
    warmupTimer = null;
    if (conectado && sock?.user?.id) {
      prontoParaEnvio = true;
      log(`Sessão pronta para envio (aguarde ${WARMUP_MS / 1000}s após conectar).`);
    }
  }, WARMUP_MS);
}

function cancelarWarmupEnvio() {
  if (warmupTimer) {
    clearTimeout(warmupTimer);
    warmupTimer = null;
  }
  conectadoEm = null;
  prontoParaEnvio = false;
}

function withTimeout(promise, ms, mensagem) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(mensagem)), ms);
    }),
  ]);
}

async function resolverJidDestino(phoneRaw) {
  const variants = variantesTelefoneBr(phoneRaw);
  if (!variants.length) throw new Error("Telefone inválido.");
  return jidFromPhone(variants[0]);
}

function jidsVariantesBr(phoneRaw) {
  return variantesTelefoneBr(phoneRaw)
    .map((digits) => jidFromPhone(digits))
    .filter(Boolean);
}

async function enviarComVariantes(phoneRaw, enviarParaJid) {
  const jids = jidsVariantesBr(phoneRaw);
  if (!jids.length) throw new Error("Telefone inválido.");
  let ultimoErro = null;
  for (const jid of jids) {
    try {
      return await enviarParaJid(jid);
    } catch (err) {
      ultimoErro = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (/instável|não conectado|aquecendo|sessão inválida/i.test(msg)) {
        throw err;
      }
    }
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error("Falha ao enviar para todos os formatos do número.");
}

function extrairIdMensagem(sent) {
  return sent?.key?.id || sent?.message?.key?.id || null;
}

function credenciaisSalvasRegistradas() {
  try {
    const creds = JSON.parse(fs.readFileSync(path.join(AUTH_DIR, "creds.json"), "utf8"));
    return Boolean(creds?.registered);
  } catch {
    return credenciaisRegistradas;
  }
}

function statusAckOk(status) {
  if (status == null) return false;
  if (status === StatusMensagem.ERROR || status === 0) return false;
  return (
    status === StatusMensagem.SERVER_ACK ||
    status === StatusMensagem.DELIVERY_ACK ||
    status === StatusMensagem.READ ||
    status === StatusMensagem.PLAYED ||
    (typeof status === "number" && status >= 2)
  );
}

function rejeitarPendentesAck(motivo) {
  for (const [id, pendente] of pendentesAck) {
    clearTimeout(pendente.timeout);
    pendente.reject(new Error(motivo));
    pendentesAck.delete(id);
  }
}

function onMessagesUpsert({ messages }) {
  for (const msg of messages || []) {
    if (!msg?.key?.fromMe) continue;
    const id = msg.key.id;
    const pendente = pendentesAck.get(id);
    if (!pendente) continue;
    if (pendente.jid && msg.key.remoteJid && msg.key.remoteJid !== pendente.jid) continue;
    const status = msg.status;
    if (status === StatusMensagem.ERROR || status === 0) {
      clearTimeout(pendente.timeout);
      pendentesAck.delete(id);
      pendente.reject(new Error("WhatsApp rejeitou o envio (erro de confirmação)."));
      continue;
    }
    if (statusAckOk(status)) {
      clearTimeout(pendente.timeout);
      pendentesAck.delete(id);
      pendente.resolve({ key: msg.key, update: { status }, status });
    }
  }
}

function onMessagesUpdate(updates) {
  for (const { key, update } of updates) {
    const id = key?.id;
    if (!id) continue;
    const pendente = pendentesAck.get(id);
    if (!pendente) continue;
    if (pendente.jid && key?.remoteJid && key.remoteJid !== pendente.jid) continue;

    const status = update?.status;
    if (status === StatusMensagem.ERROR || status === 0) {
      clearTimeout(pendente.timeout);
      pendentesAck.delete(id);
      pendente.reject(new Error("WhatsApp rejeitou o envio (erro de confirmação)."));
      continue;
    }
    if (statusAckOk(status)) {
      clearTimeout(pendente.timeout);
      pendentesAck.delete(id);
      pendente.resolve({ key, update, status });
    }
  }
}

function aguardarAckEntrega(msgKey, timeoutMs = ACK_TIMEOUT_MS) {
  const id = msgKey?.id;
  if (!id) {
    return Promise.reject(new Error("WhatsApp não retornou ID da mensagem."));
  }
  if (pendentesAck.has(id)) {
    return pendentesAck.get(id).promise;
  }

  let resolveFn;
  let rejectFn;
  const promise = new Promise((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  const timeout = setTimeout(() => {
    pendentesAck.delete(id);
    rejectFn(new Error("WhatsApp não confirmou entrega no prazo (timeout de ack)."));
  }, timeoutMs);

  pendentesAck.set(id, {
    promise,
    resolve: resolveFn,
    reject: rejectFn,
    timeout,
    jid: msgKey.remoteJid,
  });

  return promise;
}

function enfileirarEnvio(fn) {
  const execucao = filaEnvio.then(fn);
  filaEnvio = execucao.catch(() => {});
  return execucao;
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

function limparSessaoParaPareamento(motivo) {
  log(`Limpando sessão (${motivo}) — gere QR ou código novamente.`);
  cancelarReconnectAgendado();
  cancelarWarmupEnvio();
  conectado = false;
  numeroConectado = null;
  credenciaisRegistradas = false;
  pairingCodeAtual = null;
  pairingPhoneAlvo = null;
  pairingCodeSolicitado = false;
  qrAtual = null;
  qrGeradoEm = null;
  reconnectAttempts = 0;
  falhasConexaoSeguidas = 0;
  limparSocketLocal();
  limparAuthDir();
}

function falhaConexaoGrave(msg, statusCode) {
  if (statusCode === DisconnectReason.badSession) return true;
  if (statusCode === DisconnectReason.loggedOut) return true;
  return /connection failure|connection closed|connection lost|timed out|conflict|forbidden/i.test(
    String(msg || "")
  );
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
  if (conectado || reconnectTimer || iniciando || pareamentoBloqueado()) return;
  if (reconnectAttempts >= 5) {
    log("Muitas tentativas — limpando sessão para gerar novo QR.");
    limparSessaoParaPareamento("max-retries");
    reconnectAttempts = 0;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void startBaileys();
    }, 2000);
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
  cancelarWarmupEnvio();
  rejeitarPendentesAck("Conexão WhatsApp caiu durante o envio.");
  limparSocketLocal();

  const statusCode = lastDisconnect?.error?.output?.statusCode;
  const msg = lastDisconnect?.error?.message || "";
  falhasConexaoSeguidas += 1;

  if (statusCode === DisconnectReason.connectionReplaced) {
    log("WhatsApp aberto em outro lugar — pare outras sessões Baileys.");
    reconnectAttempts = 5;
    return;
  }

  if (statusCode === DisconnectReason.restartRequired) {
    log("Pareamento OK — reconectando…");
    reconnectAttempts = 0;
    falhasConexaoSeguidas = 0;
    qrAtual = null;
    qrGeradoEm = null;
    cancelarReconnectAgendado();
    void startBaileys();
    return;
  }

  if (falhaConexaoGrave(msg, statusCode) || falhasConexaoSeguidas >= 2) {
    limparSessaoParaPareamento(msg || `code=${statusCode ?? "?"}`);
    agendarReconnect("nova-sessao", 2000);
    return;
  }

  log("Conexão fechada.", msg || `code=${statusCode ?? "?"}`);
  agendarReconnect("close", 10_000);
}

async function aguardarPairingCodeLocal(maxMs = 45_000) {
  const inicio = Date.now();
  while (Date.now() - inicio < maxMs) {
    if (conectado) return { connected: true, qr: null, phone: numeroConectado, pairingCode: null };
    if (pairingCodeAtual) {
      return {
        connected: false,
        qr: null,
        phone: null,
        pairingCode: pairingCodeAtual,
        pairingCodeFormatado: formatarCodigoPareamento(pairingCodeAtual),
      };
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  return {
    connected: conectado,
    qr: null,
    phone: numeroConectado,
    pairingCode: pairingCodeAtual,
    pairingCodeFormatado: formatarCodigoPareamento(pairingCodeAtual),
  };
}

async function tentarGerarPairingCode(sockInst, state) {
  if (!pairingPhoneAlvo || state.creds?.registered || pairingCodeAtual || pairingCodeSolicitado) {
    return;
  }
  if (!sockInst?.ws?.isOpen && !conectado) {
    return;
  }
  pairingCodeSolicitado = true;
  try {
    await new Promise((r) => setTimeout(r, 1500));
    const code = await sockInst.requestPairingCode(pairingPhoneAlvo);
    pairingCodeAtual = code;
    qrAtual = null;
    qrGeradoEm = null;
    pairingPhoneAlvo = null;
    log(`Código de pareamento: ${formatarCodigoPareamento(code)}`);
    log("No celular: Aparelhos conectados → Conectar dispositivo → Vincular com número de telefone.");
  } catch (err) {
    pairingCodeSolicitado = false;
    const msg = err instanceof Error ? err.message : String(err);
    log("Erro ao gerar código:", msg);
    if (/connection closed|connection failure|timed out/i.test(msg)) {
      falhasConexaoSeguidas += 1;
      if (falhasConexaoSeguidas >= 2) {
        pairingPhoneAlvo = null;
        limparSessaoParaPareamento("pairing-failed");
        agendarReconnect("pairing-retry", 2000);
      }
    }
  }
}

async function iniciarPareamentoPorCodigo(telefoneRaw, opts = { reset: true }) {
  const telefone = normalizarTelefonePareamento(telefoneRaw);
  if (!telefone) {
    throw new Error("Telefone inválido. Use DDI+DDD+número, ex: 5533999123456");
  }

  if (conectado) {
    return { connected: true, qr: null, phone: numeroConectado, pairingCode: null };
  }

  pairingPhoneAlvo = telefone;
  pairingCodeAtual = null;
  pairingCodeSolicitado = false;

  if (opts.reset) {
    cancelarReconnectAgendado();
    limparSessaoParaPareamento("pairing-reset");
    pairingPhoneAlvo = telefone;
    pairingCodeAtual = null;
    pairingCodeSolicitado = false;
  }

  await startBaileys();
  return aguardarPairingCodeLocal(50_000);
}

async function startBaileys() {
  if (conectado) return;
  if (iniciando) return;
  if (sock) {
    limparSocketLocal();
  }

  const cooldown = lerCooldown();
  if (cooldown.active) {
    log(`Pareamento pausado até ${cooldown.until} — não gerar QR.`);
    return;
  }

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
      shouldSyncHistoryMessage: () => false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      browser: browserWhatsApp(),
      connectTimeoutMs: 90_000,
      defaultQueryTimeoutMs: 90_000,
      keepAliveIntervalMs: 15_000,
      retryRequestDelayMs: 500,
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

    sock.ev.on("messages.update", onMessagesUpdate);
    sock.ev.on("messages.upsert", onMessagesUpsert);

    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && !conectado) {
        registrarQr(qr);
        if (pairingPhoneAlvo && !pairingCodeAtual) {
          void tentarGerarPairingCode(sock, state);
        }
      }

      if (
        pairingPhoneAlvo &&
        !state.creds?.registered &&
        !pairingCodeAtual &&
        connection === "open"
      ) {
        void tentarGerarPairingCode(sock, state);
      }

      if (connection === "connecting") {
        log("Conectando…");
      }

      if (connection === "open") {
        conectado = true;
        credenciaisRegistradas = true;
        falhasConexaoSeguidas = 0;
        qrAtual = null;
        qrGeradoEm = null;
        pairingCodeAtual = null;
        pairingCodeSolicitado = false;
        reconnectAttempts = 0;
        cancelarReconnectAgendado();
        limparCooldown();
        numeroConectado = extrairNumeroUsuario(sock);
        agendarWarmupEnvio();
        log("Conectado ao WhatsApp.", numeroConectado || "", `Aguarde ${WARMUP_MS / 1000}s antes de disparar.`);
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

async function resetarSessaoCompleta(force = false) {
  const cooldown = lerCooldown();
  if (cooldown.active && !force) {
    return {
      connected: false,
      qr: null,
      phone: null,
      pairingBlocked: true,
      pairingBlockedUntil: cooldown.until,
    };
  }

  if (force && cooldown.active) {
    limparCooldown();
  }

  limparSessaoParaPareamento("reset-manual");
  await startBaileys();
  return aguardarQrLocal(50_000);
}

async function enviarMensagem(phone, message) {
  return enfileirarEnvio(() =>
    withTimeout(
      (async () => {
        if (!conexaoEnvioOk()) {
          const restante = segundosWarmupRestantes();
          if (conectado && restante > 0) {
            throw new Error(`Sessão aquecendo — aguarde ${restante}s após conectar.`);
          }
          conectado = false;
          throw new Error("WhatsApp não conectado ou sessão inválida. Reconecte em Disparos WhatsApp.");
        }
        const texto = String(message || "").trim();
        if (!texto) throw new Error("Mensagem vazia.");

        const resultado = await enviarComVariantes(phone, async (jid) => {
          const sent = await sock.sendMessage(jid, { text: texto });
          const messageId = extrairIdMensagem(sent);
          if (!messageId) {
            throw new Error("WhatsApp não retornou ID da mensagem — envio não confirmado.");
          }
          void aguardarAckEntrega(sent?.key || { id: messageId, remoteJid: jid })
            .then((ack) => {
              log("Mensagem confirmada pelo WhatsApp", {
                jid,
                messageId,
                status: ack.status,
              });
            })
            .catch((err) => {
              log("Ack da mensagem não confirmado", {
                jid,
                messageId,
                erro: err instanceof Error ? err.message : String(err),
              });
            });
          return { messageId, jid, ack: { status: null } };
        });

        log("Mensagem enviada ao WhatsApp", {
          jid: resultado.jid,
          messageId: resultado.messageId,
        });
        return { ok: true, messageId: resultado.messageId, jid: resultado.jid, ack: true };
      })(),
      ENVIO_TIMEOUT_MS,
      "Envio excedeu o tempo limite — tente novamente."
    )
  );
}

async function enviarMidia(phone, body) {
  return enfileirarEnvio(() =>
    withTimeout(
      (async () => {
        if (!conexaoEnvioOk()) {
          const restante = segundosWarmupRestantes();
          if (conectado && restante > 0) {
            throw new Error(`Sessão aquecendo — aguarde ${restante}s após conectar.`);
          }
          conectado = false;
          throw new Error("WhatsApp não conectado. Escaneie o QR Code.");
        }

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

        const resultado = await enviarComVariantes(phone, async (jid) => {
          const sent = await sock.sendMessage(jid, content);
          const messageId = extrairIdMensagem(sent);
          if (!messageId) {
            throw new Error("WhatsApp não retornou ID da mídia — envio não confirmado.");
          }
          void aguardarAckEntrega(sent?.key || { id: messageId, remoteJid: jid })
            .then((ack) => {
              log("Mídia confirmada pelo WhatsApp", {
                jid,
                messageId,
                status: ack.status,
              });
            })
            .catch((err) => {
              log("Ack da mídia não confirmado", {
                jid,
                messageId,
                erro: err instanceof Error ? err.message : String(err),
              });
            });
          return { messageId, jid, ack: { status: null } };
        });

        log("Mídia enviada ao WhatsApp", {
          jid: resultado.jid,
          messageId: resultado.messageId,
        });
        return { ok: true, messageId: resultado.messageId, jid: resultado.jid, ack: true };
      })(),
      ENVIO_TIMEOUT_MS + 20_000,
      "Envio de mídia excedeu o tempo limite — tente novamente."
    )
  );
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);

    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, { ok: true });
    }

    if (req.method === "GET" && url.pathname === "/status") {
      const cooldown = lerCooldown();
      return json(res, 200, {
        connected: conectado,
        prontoParaEnvio: conexaoEnvioOk(),
        warmupRestanteSegundos: segundosWarmupRestantes(),
        qr: conectado || cooldown.active ? null : qrAtual || null,
        phone: numeroConectado,
        authDir: AUTH_DIR,
        iniciando,
        hasSocket: Boolean(sock),
        credenciaisRegistradas,
        reconnectAttempts,
        pareamentoEmAndamento: credenciaisRegistradas && !conectado,
        pairingBlocked: cooldown.active,
        pairingBlockedUntil: cooldown.active ? cooldown.until : null,
        pairingBlockedReason: cooldown.active ? cooldown.reason : null,
        pairingCode: conectado ? null : pairingCodeAtual,
        pairingCodeFormatado: conectado ? null : formatarCodigoPareamento(pairingCodeAtual),
        pairingPhoneAlvo,
      });
    }

    if (url.pathname === "/pairing-code" && req.method === "POST") {
      if (!autorizado(req)) return json(res, 401, { ok: false, error: "Não autorizado" });
      const body = await lerJson(req);
      const telefone = body.phone || body.telefone || process.env.WHATSAPP_PAIRING_PHONE;
      try {
        const result = await iniciarPareamentoPorCodigo(telefone, { reset: body.reset !== false });
        return json(res, 200, { ok: true, ...result });
      } catch (err) {
        return json(res, 422, {
          ok: false,
          error: err instanceof Error ? err.message : "Falha ao gerar código",
        });
      }
    }

    if (url.pathname === "/send" && req.method === "POST") {
      if (!autorizado(req)) return json(res, 401, { ok: false, error: "Não autorizado" });
      const body = await lerJson(req);
      const result = await enviarMensagem(body.phone || body.telefone, body.message || body.mensagem);
      return json(res, 200, result);
    }

    if (url.pathname === "/send-media" && req.method === "POST") {
      if (!autorizado(req)) return json(res, 401, { ok: false, error: "Não autorizado" });
      const body = await lerJson(req);
      const result = await enviarMidia(body.phone || body.telefone, body);
      return json(res, 200, result);
    }

    if (url.pathname === "/logout" && req.method === "POST") {
      if (!autorizado(req)) return json(res, 401, { ok: false, error: "Não autorizado" });
      await resetarSessaoCompleta();
      return json(res, 200, { ok: true });
    }

    if (url.pathname === "/pause-pairing" && req.method === "POST") {
      if (!autorizado(req)) return json(res, 401, { ok: false, error: "Não autorizado" });
      let body = {};
      try {
        body = await lerJson(req);
      } catch {
        body = {};
      }
      const horas = Math.max(1, Number(body.horas || COOLDOWN_PADRAO_HORAS));
      ativarCooldown("pausa-manual", horas);
      return json(res, 200, { ok: true, pairingBlockedUntil: lerCooldown().until });
    }

    if (url.pathname === "/reconnect" && req.method === "POST") {
      if (!autorizado(req)) return json(res, 401, { ok: false, error: "Não autorizado" });

      let body = {};
      try {
        body = await lerJson(req);
      } catch {
        body = {};
      }

      const cooldown = lerCooldown();
      const force = Boolean(body.force);
      if (cooldown.active && !force) {
        return json(res, 429, {
          ok: false,
          pairingBlocked: true,
          pairingBlockedUntil: cooldown.until,
          error:
            "WhatsApp bloqueou novos dispositivos. Aguarde 24h, remova aparelhos antigos no celular e tente de novo.",
        });
      }

      if (force && cooldown.active) {
        limparCooldown();
      }

      if (conectado) {
        return json(res, 200, { ok: true, connected: true, qr: null, phone: numeroConectado });
      }

      if (credenciaisRegistradas && !conectado) {
        if (falhasConexaoSeguidas >= 1) {
          log("Sessão antiga inválida — limpando para gerar QR.");
          limparSessaoParaPareamento("reconnect-stale");
          await startBaileys();
        } else if (!sock && !iniciando) {
          void startBaileys();
        }
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
        const aguardado = await resetarSessaoCompleta(force);
        if (aguardado.pairingBlocked) {
          return json(res, 429, {
            ok: false,
            pairingBlocked: true,
            pairingBlockedUntil: aguardado.pairingBlockedUntil,
            error: "Pareamento pausado — aguarde o bloqueio do WhatsApp expirar.",
          });
        }
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
  const cooldown = lerCooldown();
  if (cooldown.active) {
    log(`Pareamento PAUSADO até ${cooldown.until} — npm run whatsapp:liberar após aguardar.`);
  } else {
    void startBaileys();
  }
});
