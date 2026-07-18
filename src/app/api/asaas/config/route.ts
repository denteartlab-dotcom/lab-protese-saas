import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import {
  type AsaasConfig,
} from "@/lib/asaas-config";
import { APP_URL } from "@/lib/app-url";
import { urlBaseAsaas, type AsaasAmbiente } from "@/lib/asaas-config";
import {
  obterConfigAsaas,
  salvarConfigAsaas,
} from "@/lib/asaas-client";
import { laboratorioUsaCnpjContaMae } from "@/lib/asaas-subconta";
import { exigirProprietario } from "@/lib/exigir-proprietario";
import { negarSeSemPermissao } from "@/lib/require-permissao";

export async function GET() {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const negado = await negarSeSemPermissao(ctx, "configuracoes-boletos", "ver");
  if (negado) return negado;

  const config = await obterConfigAsaas(ctx.empresaId);
  const podeUsarIntegracaoManual = await laboratorioUsaCnpjContaMae(ctx.empresaId);
  return NextResponse.json({
    config: {
      ambiente: config.ambiente,
      apiKeyConfigurada: Boolean(config.apiKey),
      webhookTokenConfigurado: Boolean(config.webhookToken),
    },
    podeUsarIntegracaoManual,
    webhookUrl: `${APP_URL}/api/asaas/webhook`,
    urlBase: urlBaseAsaas(config.ambiente),
  });
}

export async function PUT(request: Request) {
  const prop = await exigirProprietario();
  if (prop.erro) return prop.erro;
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const podeUsarIntegracaoManual = await laboratorioUsaCnpjContaMae(ctx.empresaId);
    if (!podeUsarIntegracaoManual) {
      return NextResponse.json(
        {
          error:
            "Integração manual disponível apenas para o laboratório com o mesmo CNPJ da conta-mãe Asaas.",
        },
        { status: 403 }
      );
    }

    const body = (await request.json()) as Partial<AsaasConfig> & {
      apiKey?: string;
      manterApiKey?: boolean;
      manterWebhookToken?: boolean;
    };
    const atual = await obterConfigAsaas(ctx.empresaId);
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

    await salvarConfigAsaas(ctx.empresaId, config);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
}
