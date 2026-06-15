import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  carregarConfigNfse,
  salvarConfigNfse,
} from "@/lib/nfse/servico";
import {
  NFSE_CONFIG_PADRAO,
  nfseConfigurada,
  type NfseConfig,
  type NfseProvedor,
} from "@/lib/nfse-config";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!session.empresaId) {
    return NextResponse.json({ error: "Empresa não identificada." }, { status: 401 });
  }

  const config = await carregarConfigNfse(session.empresaId);
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
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!session.empresaId) {
    return NextResponse.json({ error: "Empresa não identificada." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Partial<NfseConfig> & {
      clientId?: string;
      clientSecret?: string;
      apiKey?: string;
      manterSecret?: boolean;
      manterApiKey?: boolean;
    };
    const atual = await carregarConfigNfse(session.empresaId);

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

    await salvarConfigNfse(session.empresaId, config);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
}
