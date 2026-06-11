import { NextResponse } from "next/server";
import { TV_SOCKET_PATH } from "@/lib/tv/tv-socket-events";
import { getTvSocketIo } from "@/lib/tv/tv-socket-io";

export async function GET() {
  const io = getTvSocketIo();
  const socketIoAtivo = Boolean(io);

  return NextResponse.json({
    socketIoAtivo,
    path: TV_SOCKET_PATH,
    servidor: socketIoAtivo ? "custom-server" : "next-only",
    ...(socketIoAtivo
      ? {}
      : {
          correcao:
            "Pare next start e inicie com npm run start (tsx server.ts). Veja deploy/ecosystem.config.cjs",
        }),
  });
}
