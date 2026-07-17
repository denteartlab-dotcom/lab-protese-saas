import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { acaoHttpParaPermissao, negarSeSemPermissao } from "@/lib/require-permissao";
import {
  carregarConfigNfse,
  salvarConfigNfse,
} from "@/lib/nfse/servico";
import {
  nfseConfigurada,
  type NfseConfig,
  type NfseProvedor,
} from "@/lib/nfse-config";

export async function GET() {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const negado = await negarSeSemPermissao(ctx, "configuracoes-nfse", "ver");
  if (negado) return negado;

  const config = await carregarConfigNfse(ctx.empresaId);
  return NextResponse.json({
    config: {
      provedor: config.provedor,
      ambiente: config.ambiente,
      codigoServicoNacional: config.codigoServicoNacional,
      codigoServicoMunicipal: config.codigoServicoMunicipal,
      aliquotaIss: config.aliquotaIss,
      descricaoServicoPadrao: config.descricaoServicoPadrao,
      credenciaisConfiguradas: nfseConfigurada(config),
    },
  });
}

export async function PUT(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const negado = await negarSeSemPermissao(ctx, "configuracoes-nfse", acaoHttpParaPermissao("PUT"));
  if (negado) return negado;

  try {
    const body = (await request.json()) as Partial<NfseConfig> & {
      clientId?: string;
      clientSecret?: string;
      apiKey?: string;
      manterSecret?: boolean;
      manterApiKey?: boolean;
    };
    const atual = await carregarConfigNfse(ctx.empresaId);

    const provedor: NfseProvedor =
      body.provedor === "nuvemfiscal" || body.provedor === "plugnotas"
        ? body.provedor
        : atual.provedor;

    const config: NfseConfig = {
      provedor,
      apiKey: body.apiKey?.trim() || (body.manterApiKey ? atual.apiKey : ""),
      clientId: body.clientId?.trim() || (body.manterSecret ? atual.clientId : ""),
      clientSecret:
        body.clientSecret?.trim() || (body.manterSecret ? atual.clientSecret : ""),
      ambiente: body.ambiente === "producao" ? "producao" : "homologacao",
      codigoServicoNacional:
        body.codigoServicoNacional?.trim() || atual.codigoServicoNacional,
      codigoServicoMunicipal:
        body.codigoServicoMunicipal?.trim() ?? atual.codigoServicoMunicipal,
      aliquotaIss:
        typeof body.aliquotaIss === "number" ? body.aliquotaIss : atual.aliquotaIss,
      descricaoServicoPadrao:
        body.descricaoServicoPadrao?.trim() || atual.descricaoServicoPadrao,
    };

    await salvarConfigNfse(ctx.empresaId, config);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
}
