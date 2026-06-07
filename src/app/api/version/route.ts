import { NextResponse } from "next/server";
import { APP_BUILD_ID } from "@/lib/app-build-id";

export async function GET() {
  return NextResponse.json(
    { buildId: APP_BUILD_ID },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    }
  );
}
