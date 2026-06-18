import { NextResponse } from "next/server";
import { obterAppBuildIdServidor } from "@/lib/app-build-id-servidor";

export async function GET() {
  return NextResponse.json(
    { buildId: obterAppBuildIdServidor() },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    }
  );
}
