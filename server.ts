import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { TV_SOCKET_PATH } from "./src/lib/tv/tv-socket-events";
import {
  getTvOrdensSnapshot,
  iniciarTvRefreshAutomatico,
} from "./src/lib/tv/tv-ordens-store";
import { setTvSocketIo } from "./src/lib/tv/tv-socket-io";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "", true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    path: TV_SOCKET_PATH,
    cors: { origin: true, credentials: true },
    transports: ["websocket", "polling"],
  });

  setTvSocketIo(io);

  io.on("connection", (socket) => {
    void getTvOrdensSnapshot().then((payload) => {
      socket.emit("tv:sync", payload);
    });
    socket.on("tv:subscribe", () => {
      void getTvOrdensSnapshot().then((payload) => {
        socket.emit("tv:sync", payload);
      });
    });
  });

  iniciarTvRefreshAutomatico();

  httpServer.listen(port, () => {
    console.log(`> Smart Prótese pronto em http://${hostname}:${port}`);
    console.log(`> Socket.io TV: ${TV_SOCKET_PATH}`);
  });
});
