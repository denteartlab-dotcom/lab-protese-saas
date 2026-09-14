import { NextResponse } from "next/server";
import {
  notificacaoGoogleDriveAutorizada,
  processarMudancasGoogleDrive,
  statusWatchGoogleDrive,
} from "@/lib/google-drive-changes";

export const dynamic = "force-dynamic";

/** Status do aviso do Drive (sem token). */
export async function GET() {
  return NextResponse.json({ ok: true, ...statusWatchGoogleDrive() });
}

/**
 * POST do Google (corpo vazio). Headers:
 * X-Goog-Channel-Token, X-Goog-Channel-ID, X-Goog-Resource-State
 */
export async function POST(request: Request) {
  const token = request.headers.get("x-goog-channel-token");
  const channelId = request.headers.get("x-goog-channel-id");
  if (!notificacaoGoogleDriveAutorizada({ token, channelId })) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const estado = (request.headers.get("x-goog-resource-state") || "").toLowerCase();
  if (estado === "sync") {
    return NextResponse.json({ ok: true, sync: true });
  }

  void processarMudancasGoogleDrive();
  return NextResponse.json({ ok: true });
}
