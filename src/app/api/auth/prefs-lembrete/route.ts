import { NextResponse } from "next/server";
import { lerJsonStoreServidor } from "@/lib/json-store-servidor";

/** Preferências de login (já entrou) — credenciais ficam só no navegador. */
export async function GET() {
  try {
    const jaEntrou = await lerJsonStoreServidor<boolean>("labProteseJaEntrou");
    return NextResponse.json({
      email: null,
      jaEntrou: jaEntrou === true,
    });
  } catch {
    return NextResponse.json({ email: null, jaEntrou: false });
  }
}
