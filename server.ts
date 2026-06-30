import { createServer } from "http";
import { execSync } from "node:child_process";
import path from "path";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { getSessionFromCookieHeader } from "./src/lib/auth-token";
import { getMasterSessionFromCookieHeader } from "./src/lib/master-auth-token";
import { prisma } from "./src/lib/db";
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

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);
const projectDir = path.resolve(process.cwd());

process.on("unhandledRejection", (motivo) => {
  console.error("[process] unhandledRejection:", motivo);
});

process.on("uncaughtException", (erro) => {
  console.error("[process] uncaughtException:", erro);
});

const app = next({ dev, hostname, port, dir: projectDir });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const httpServer = createServer();

    const io = new SocketIOServer(httpServer, {
      path: TV_SOCKET_PATH,
      cors: { origin: true, credentials: true },
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
          const empresa = await prisma.empresa.findUnique({
            where: { slug: session.empresaSlug },
            select: { id: true },
          });
          empresaId = empresa?.id;
        }
        if (!empresaId) return null;

        const usuario = await prisma.user.findFirst({
          where: { id: session.id, empresaId, excluidoEm: null },
          select: {
            id: true,
            name: true,
            colaboradorId: true,
            colaboradorNome: true,
          },
        });
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
          const empresa = await prisma.empresa.findUnique({
            where: { slug: session.empresaSlug },
            select: { id: true },
          });
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
      handle(req, res, parsedUrl);
    });

    iniciarTvRefreshAutomatico();

    void aquecerServidor()
      .then(() => {
        console.log("> Banco de dados aquecido");
        iniciarManutencaoServidor();
      })
      .catch((erro) => {
        console.error("> Falha ao aquecer banco (tentará de novo no keepalive):", erro);
        iniciarManutencaoServidor();
      });

    const iniciarHttp = (tentativa = 1) => {
      httpServer.once("error", (erro: NodeJS.ErrnoException) => {
        if (erro.code === "EADDRINUSE" && tentativa < 4) {
          console.warn(
            `> Porta ${port} ocupada (tentativa ${tentativa}/3). Liberando e tentando de novo...`
          );
          try {
            if (process.platform === "win32") {
              const ps = execSync(
                `powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue).OwningProcess"`,
                { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }
              );
              for (const linha of ps.split(/\r?\n/)) {
                const pid = linha.trim();
                if (pid && /^\d+$/.test(pid) && pid !== String(process.pid)) {
                  execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
                }
              }
            } else {
              const saida = execSync(`lsof -ti tcp:${port}`, {
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
        console.error("Falha ao escutar na porta", port, erro);
        process.exit(1);
      });

      httpServer.listen(port, () => {
        console.log(`> Smart Prótese pronto em http://${hostname}:${port}`);
        console.log(`> Socket.io TV: ${TV_SOCKET_PATH}`);

        if (typeof process.send === "function") {
          process.send("ready");
        }

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
        }, 15_000);
      });
    };

    iniciarHttp();
  })
  .catch((erro) => {
    console.error("Falha ao iniciar o servidor Next.js:", erro);
    process.exit(1);
  });
