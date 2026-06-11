import { NextResponse } from "next/server";
import { TV_SOCKET_PATH } from "@/lib/tv/tv-socket-events";
import { getTvSocketIo } from "@/lib/tv/tv-socket-io";

export async function GET() {
  const io = getTvSocketIo();
  return NextResponse.json({
    socketIoAtivo: Boolean(io),
    path: TV_SOCKET_PATH,
    servidor: io ? "custom-server" : "next-only",
  });
}
