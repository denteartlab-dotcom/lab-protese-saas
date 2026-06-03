import { NextResponse } from "next/server";
import { lerJsonStoreServidor } from "@/lib/json-store-servidor";

/** Preferências de login (e-mail lembrado, já entrou) — sem autenticação. */
export async function GET() {
  try {
    const lembrar = await lerJsonStoreServidor<{ email?: string } | null>(
      "labProteseLembrarLogin"
    );
    const jaEntrou = await lerJsonStoreServidor<boolean>("labProteseJaEntrou");
    return NextResponse.json({
      email: lembrar?.email?.trim() || null,
      jaEntrou: jaEntrou === true,
    });
  } catch {
    return NextResponse.json({ email: null, jaEntrou: false });
  }
}
