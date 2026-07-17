import "./server-init-node";
import { createServer } from "http";
import { execSync } from "node:child_process";
import path from "path";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { getSessionFromCookieHeader } from "./src/lib/auth-token";
import { getMasterSessionFromCookieHeader } from "./src/lib/master-auth-token";
import { marcarBancoIndisponivel, tratarErroBancoSilencioso } from "./src/lib/banco-circuit-breaker";
import { executarSemRls } from "./src/lib/db";
import { tenantStorage } from "./src/lib/prisma-tenant";
import { requisicaoTvSocket } from "./src/lib/tv/tv-socket-client";
import { TV_SOCKET_PATH } from "./src/lib/tv/tv-socket-events";
import {
  SUPORTE_SOCKET_EVENTS,
  salaSuporteEmpresa,
  salaSuporteMaster,
} from "./src/lib/suporte/suporte-socket-events";
import {
  conectarPresencaUsuario,
  desconectarPresencaUsuario,
} from "./src/lib/presenca-usuarios";
import {
  conectarPresencaMasterSuporte,
  desconectarPresencaMasterSuporte,
} from "./src/lib/suporte/presenca-suporte-master";
import { iniciarLimpezaSuporteInativo } from "./src/lib/suporte/suporte-limpeza";
import { notificarPresencaTv } from "./src/lib/tv/notificar-presenca-tv";
import { iniciarBackupAutomaticoDiario } from "./src/lib/backup-automatico";
import { iniciarLimpezaContasInativasDiaria } from "./src/lib/exclusao-empresa";
import { backupAutomaticoHabilitadoNoServidor } from "./src/lib/backup-automatico-servidor";
import {
  getTvOrdensSnapshot,
  iniciarTvRefreshAutomatico,
  salaTvEmpresa,
} from "./src/lib/tv/tv-ordens-store";
import { setTvSocketIo } from "./src/lib/tv/tv-socket-io";
import { aquecerServidor, iniciarManutencaoServidor } from "./src/lib/servidor-saude";
import {
  metricasApiHabilitadas,
  normalizarRotaApi,
  registrarMetricaApi,
} from "./src/lib/api-observabilidade";
import {
  DISPARO_SOCKET_EVENTS,
  salaDisparoEmpresa,
} from "./src/lib/whatsapp-disparos/disparos-socket-events";
import { retomarCampanhasPendentesServidor } from "./src/lib/whatsapp-disparos/campaign-queue";
import { iniciarMonitorConexaoWhatsapp } from "./src/lib/whatsapp-disparos/conexao-monitor";

const dev = process.env.NODE_ENV !== "production";
/** Endereço de bind do HTTP (0.0.0.0 = todas as interfaces). NÃO use isso em redirects. */
const listenHost = process.env.HOSTNAME || "0.0.0.0";

function hostnamePublicoParaNext(): string {
  const explícito = process.env.NEXT_HOSTNAME?.trim();
  if (explícito && explícito !== "0.0.0.0" && explícito !== "::") {
    return explícito;
  }
  for (const raw of [
    process.env.URL_PUBLICA_DO_APP,
    process.env.NEXT_PUBLIC_APP_URL,
  ]) {
    const v = raw?.trim();
    if (!v) continue;
    try {
      const host = new URL(v).hostname.toLowerCase();
      if (host && host !== "0.0.0.0" && host !== "localhost" && host !== "127.0.0.1") {
        return host;
      }
    } catch {
      /* ignora */
    }
  }
  // Dev local: ok. Produção sem URL pública: evita 0.0.0.0 no browser.
  return "localhost";
}

/**
 * Hostname do Next (redirects absolutos). Deve ser o domínio público
 * (ex.: www.denteartlab.com.br), NUNCA 0.0.0.0 nem bind address.
 */
const nextHostname = hostnamePublicoParaNext();
/** Porta em que o Node escuta (nginx faz proxy → 3000). */
const listenPort = parseInt(process.env.PORT || "3000", 10);
/**
 * Porta que o Next usa em redirects absolutos.
 * Em produção atrás de nginx/HTTPS, NÃO usar 3000 — o browser tenta
 * denteartlab.com.br:3000 e dá timeout (porta fechada na internet).
 */
function portaPublicaParaNext(): number {
  if (!dev) {
    const explícita = process.env.NEXT_PUBLIC_PORT?.trim();
    if (explícita && /^\d+$/.test(explícita)) return parseInt(explícita, 10);
    try {
      const base =
        process.env.URL_PUBLICA_DO_APP?.trim() ||
        process.env.NEXT_PUBLIC_APP_URL?.trim() ||
        "";
      if (base) {
        const u = new URL(base);
        if (u.port) return parseInt(u.port, 10);
        return u.protocol === "https:" ? 443 : 80;
      }
    } catch {
      /* ignora */
    }
    return 443;
  }
  return listenPort;
}
const nextPort = portaPublicaParaNext();
const projectDir = path.resolve(process.cwd());

if (dev && process.platform === "win32") {
  process.env.WATCHPACK_POLLING = "true";
  process.env.CHOKIDAR_USEPOLLING = "1";
}

process.on("unhandledRejection", (motivo) => {
  if (tratarErroBancoSilencioso(motivo)) return;
  console.error("[process] unhandledRejection:", motivo);
});

process.on("uncaughtException", (erro) => {
  if (tratarErroBancoSilencioso(erro)) return;
  console.error("[process] uncaughtException:", erro);
});

const app = next({
  dev,
  hostname: nextHostname,
  port: nextPort,
  dir: projectDir,
});
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const httpServer = createServer();

    const origensSocketPermitidas = (() => {
      const urls = [
        process.env.NEXT_PUBLIC_APP_URL?.trim(),
        process.env.URL_PUBLICA_DO_APP?.trim(),
        "https://www.denteartlab.com.br",
        "https://denteartlab.com.br",
      ].filter(Boolean) as string[];
      const set = new Set<string>();
      for (const raw of urls) {
        try {
          const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
          set.add(u.origin);
          const host = u.hostname.replace(/^www\./, "");
          set.add(`${u.protocol}//${host}`);
          set.add(`${u.protocol}//www.${host}`);
        } catch {
          /* ignore */
        }
      }
      if (process.env.NODE_ENV !== "production") {
        set.add("http://localhost:3000");
        set.add("http://127.0.0.1:3000");
      }
      return [...set];
    })();

    const io = new SocketIOServer(httpServer, {
      path: TV_SOCKET_PATH,
      cors: {
        origin: (origin, callback) => {
          // Handshake sem Origin (apps nativos / same-origin) ou lista explícita.
          if (!origin || origensSocketPermitidas.includes(origin)) {
            callback(null, true);
            return;
          }
          callback(new Error(`Origin Socket.IO não permitida: ${origin}`), false);
        },
        credentials: true,
      },
      transports: ["polling", "websocket"],
      pingTimeout: 60_000,
      pingInterval: 25_000,
    });

    setTvSocketIo(io);

    io.on("connection", (socket) => {
      let presencaEmpresaId: string | null = null;
      let presencaUserId: string | null = null;

      const registrarPresenca = async () => {
        const cookie = socket.handshake.headers.cookie;
        const session = await getSessionFromCookieHeader(cookie);
        if (!session?.id) return null;

        let empresaId = session.empresaId;
        if (!empresaId && session.empresaSlug) {
          const empresa = await executarSemRls((tx) =>
            tx.empresa.findUnique({
              where: { slug: session.empresaSlug! },
              select: { id: true },
            })
          );
          empresaId = empresa?.id;
        }
        if (!empresaId) return null;

        const usuario = await executarSemRls((tx) =>
          tx.user.findFirst({
            where: { id: session.id, empresaId, excluidoEm: null },
            select: {
              id: true,
              name: true,
              colaboradorId: true,
              colaboradorNome: true,
            },
          })
        );
        if (!usuario) return null;

        presencaEmpresaId = empresaId;
        presencaUserId = usuario.id;
        conectarPresencaUsuario(empresaId, socket.id, {
          userId: usuario.id,
          name: usuario.name,
          colaboradorId: usuario.colaboradorId,
          colaboradorNome: usuario.colaboradorNome,
        });
        void notificarPresencaTv(empresaId);
        return empresaId;
      };

      const enviarSyncEmpresa = async () => {
        const cookie = socket.handshake.headers.cookie;
        const session = await getSessionFromCookieHeader(cookie);
        let empresaId = session?.empresaId;
        if (!empresaId && session?.empresaSlug) {
          const empresa = await executarSemRls((tx) =>
            tx.empresa.findUnique({
              where: { slug: session.empresaSlug! },
              select: { id: true },
            })
          );
          empresaId = empresa?.id;
        }
        if (!empresaId) return;

        await socket.join(salaTvEmpresa(empresaId));
        const payload = await getTvOrdensSnapshot(empresaId);
        socket.emit("tv:sync", payload);
      };

      void (async () => {
        await registrarPresenca();
        await enviarSyncEmpresa();
      })();

      socket.on("tv:subscribe", () => {
        void enviarSyncEmpresa();
      });

      socket.on(DISPARO_SOCKET_EVENTS.subscribe, () => {
        void (async () => {
          const empresaId = presencaEmpresaId ?? (await registrarPresenca());
          if (empresaId) await socket.join(salaDisparoEmpresa(empresaId));
        })();
      });

      socket.on(SUPORTE_SOCKET_EVENTS.joinEmpresa, () => {
        void (async () => {
          const empresaId = presencaEmpresaId ?? (await registrarPresenca());
          if (empresaId) await socket.join(salaSuporteEmpresa(empresaId));
        })();
      });

      socket.on(SUPORTE_SOCKET_EVENTS.joinMaster, () => {
        void (async () => {
          const master = await getMasterSessionFromCookieHeader(
            socket.handshake.headers.cookie
          );
          if (master) {
            await socket.join(salaSuporteMaster());
            conectarPresencaMasterSuporte(socket.id);
          }
        })();
      });

      socket.on("disconnect", () => {
        desconectarPresencaMasterSuporte(socket.id);
        if (!presencaEmpresaId || !presencaUserId) return;
        desconectarPresencaUsuario(presencaEmpresaId, presencaUserId, socket.id);
        void notificarPresencaTv(presencaEmpresaId);
      });
    });

    httpServer.on("request", (req, res) => {
      const parsedUrl = parse(req.url ?? "", true);
      const pathname = parsedUrl.pathname ?? "";
      if (requisicaoTvSocket(pathname)) return;

      const medirApi =
        metricasApiHabilitadas() && pathname.startsWith("/api");
      const inicioApi = medirApi ? Date.now() : 0;
      const metodoApi = req.method ?? "GET";

      const promessaSessaoMetrica = medirApi
        ? getSessionFromCookieHeader(req.headers.cookie)
        : null;

      if (medirApi) {
        res.on("finish", () => {
          void promessaSessaoMetrica?.then((session) => {
            registrarMetricaApi({
              rota: normalizarRotaApi(pathname),
              metodo: metodoApi,
              duracaoMs: Date.now() - inicioApi,
              status: res.statusCode,
              empresaId: session?.empresaId,
            });
          });
        });
      }

      // Store mutável por request: requireEmpresaContext preenche empresaId e
      // o Prisma (RLS) enxerga em qualquer ponto do request — sem depender de
      // enterWith atravessar as fronteiras async do Next em produção.
      tenantStorage.run({}, () => {
        void handle(req, res, parsedUrl);
      });
    });

    iniciarTvRefreshAutomatico();

    void aquecerServidor()
      .then(() => {
        console.log("> Banco de dados conectado");
        iniciarManutencaoServidor();
      })
      .catch(() => {
        console.warn(
          "> Postgres indisponível no boot — servidor sobe em modo degradado; keepalive tentará reconectar."
        );
        iniciarManutencaoServidor();
      });

    const iniciarHttp = (tentativa = 1) => {
      httpServer.once("error", (erro: NodeJS.ErrnoException) => {
        if (erro.code === "EADDRINUSE" && tentativa < 4) {
          console.warn(
            `> Porta ${listenPort} ocupada (tentativa ${tentativa}/3). Liberando e tentando de novo...`
          );
          try {
            if (process.platform === "win32") {
              const ps = execSync(
                `powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort ${listenPort} -State Listen -ErrorAction SilentlyContinue).OwningProcess"`,
                { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }
              );
              for (const linha of ps.split(/\r?\n/)) {
                const pid = linha.trim();
                if (pid && /^\d+$/.test(pid) && pid !== String(process.pid)) {
                  execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
                }
              }
            } else {
              const saida = execSync(`lsof -ti tcp:${listenPort}`, {
                encoding: "utf8",
                stdio: ["pipe", "pipe", "ignore"],
              });
              for (const linha of saida.split(/\s+/)) {
                const pid = linha.trim();
                if (pid && /^\d+$/.test(pid) && pid !== String(process.pid)) {
                  process.kill(Number(pid), "SIGKILL");
                }
              }
            }
          } catch {
            /* ignore */
          }
          setTimeout(() => iniciarHttp(tentativa + 1), 600);
          return;
        }
        console.error("Falha ao escutar na porta", listenPort, erro);
        process.exit(1);
      });

      httpServer.listen(listenPort, listenHost, () => {
        console.log(
          `> Lab Prótese ouvindo em ${listenHost}:${listenPort} (Next hostname=${nextHostname} publicPort=${nextPort})`
        );
        console.log(`> Socket.io TV: ${TV_SOCKET_PATH}`);
        iniciarMonitorConexaoWhatsapp();
        void retomarCampanhasPendentesServidor();

        if (dev && process.env.DEV_PREWARM !== "0") {
          const base = `http://127.0.0.1:${listenPort}`;
          const slugDev = process.env.DEV_PREWARM_SLUG?.trim() || "denteart";
          setTimeout(() => {
            console.log("> Pré-compilando rotas críticas (dev)…");
            void Promise.allSettled([
              fetch(`${base}/login`),
              fetch(`${base}/api/health`),
              fetch(`${base}/api/armazenamento/bootstrap?fase=prioritaria`),
              fetch(`${base}/app/${slugDev}`),
              fetch(`${base}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}",
              }),
            ]).then(() => console.log("> Rotas críticas pré-compiladas"));
          }, 2500);
        }

        if (typeof process.send === "function") {
          process.send("ready");
        }

        const delayJobsMs = parseInt(
          process.env.BACKUP_AUTOMATICO_DELAY_MS || "15000",
          10
        );
        setTimeout(() => {
          if (backupAutomaticoHabilitadoNoServidor()) {
            void iniciarBackupAutomaticoDiario();
          } else {
            console.log(
              "[backup-automatico] desativado (BACKUP_AUTOMATICO_ENABLED=false ou 0)."
            );
          }
          iniciarLimpezaContasInativasDiaria();
          iniciarLimpezaSuporteInativo();
          void retomarCampanhasPendentesServidor();
        }, delayJobsMs);
      });
    };

    iniciarHttp();
  })
  .catch((erro) => {
    console.error("Falha ao iniciar o servidor Next.js:", erro);
    process.exit(1);
  });
