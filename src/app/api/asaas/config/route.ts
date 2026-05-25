import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  ASAAS_CONFIG_KEY,
  ASAAS_CONFIG_PADRAO,
  type AsaasConfig,
} from "@/lib/asaas-config";
import { urlBaseAsaas, type AsaasAmbiente } from "@/lib/asaas-config";

async function lerConfig(): Promise<AsaasConfig> {
  const row = await prisma.jsonStore.findUnique({
    where: { key: ASAAS_CONFIG_KEY },
  });
  if (!row) return { ...ASAAS_CONFIG_PADRAO };
  try {
    const parsed = JSON.parse(row.payload) as Partial<AsaasConfig>;
    return {
      apiKey: parsed.apiKey?.trim() || "",
      ambiente: parsed.ambiente === "producao" ? "producao" : "sandbox",
      webhookToken: parsed.webhookToken?.trim() || "",
    };
  } catch {
    return { ...ASAAS_CONFIG_PADRAO };
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const config = await lerConfig();
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";

  return NextResponse.json({
    config: {
      ambiente: config.ambiente,
      apiKeyConfigurada: Boolean(config.apiKey),
      webhookTokenConfigurado: Boolean(config.webhookToken),
    },
    webhookUrl: `${origin}/api/asaas/webhook`,
    urlBase: urlBaseAsaas(config.ambiente),
  });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Partial<AsaasConfig> & {
      apiKey?: string;
      manterApiKey?: boolean;
      manterWebhookToken?: boolean;
    };
    const atual = await lerConfig();
    const apiKey =
      body.apiKey?.trim() ||
      (body.manterApiKey ? atual.apiKey : "") ||
      "";
    const webhookInformado = body.webhookToken?.trim();
    const webhookToken =
      webhookInformado && !webhookInformado.startsWith("*")
        ? webhookInformado
        : body.manterWebhookToken !== false
          ? atual.webhookToken
          : "";

    const config: AsaasConfig = {
      apiKey,
      ambiente: (body.ambiente === "producao" ? "producao" : "sandbox") as AsaasAmbiente,
      webhookToken,
    };

    await prisma.jsonStore.upsert({
      where: { key: ASAAS_CONFIG_KEY },
      create: {
        key: ASAAS_CONFIG_KEY,
        payload: JSON.stringify(config),
      },
      update: { payload: JSON.stringify(config) },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
}
