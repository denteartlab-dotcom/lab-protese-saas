import { prisma } from "@/lib/db";
import { CONFIG_LAB_STORAGE_KEY, type ConfigLaboratorio } from "@/lib/configuracoes-lab";
import {
  NFSE_CONFIG_KEY,
  NFSE_CONFIG_PADRAO,
  nfseConfigurada,
  type NfseConfig,
} from "@/lib/nfse-config";
import { emitirNfseNuvemFiscal } from "@/lib/nfse/nuvem-fiscal";
import { emitirNfsePlugnotas } from "@/lib/nfse/plugnotas";
import type { TomadorNfse } from "@/lib/nfse/types";

export async function carregarConfigNfse(): Promise<NfseConfig> {
  const row = await prisma.jsonStore.findUnique({
    where: { key: NFSE_CONFIG_KEY },
  });
  if (!row) return { ...NFSE_CONFIG_PADRAO };
  try {
    const parsed = JSON.parse(row.payload) as Partial<NfseConfig>;
    const provedor: NfseConfig["provedor"] =
      parsed.provedor === "nuvemfiscal" || parsed.provedor === "plugnotas"
        ? parsed.provedor
        : parsed.clientId?.trim() && parsed.clientSecret?.trim()
          ? "nuvemfiscal"
          : NFSE_CONFIG_PADRAO.provedor;
    return {
      provedor,
      apiKey: parsed.apiKey?.trim() || "",
      clientId: parsed.clientId?.trim() || "",
      clientSecret: parsed.clientSecret?.trim() || "",
      ambiente: parsed.ambiente === "producao" ? "producao" : "homologacao",
      codigoServicoNacional:
        parsed.codigoServicoNacional?.trim() || NFSE_CONFIG_PADRAO.codigoServicoNacional,
      codigoServicoMunicipal: parsed.codigoServicoMunicipal?.trim() || "",
      aliquotaIss:
        typeof parsed.aliquotaIss === "number" && parsed.aliquotaIss >= 0
          ? parsed.aliquotaIss
          : NFSE_CONFIG_PADRAO.aliquotaIss,
      descricaoServicoPadrao:
        parsed.descricaoServicoPadrao?.trim() || NFSE_CONFIG_PADRAO.descricaoServicoPadrao,
    };
  } catch {
    return { ...NFSE_CONFIG_PADRAO };
  }
}

export async function carregarLabServidor(): Promise<ConfigLaboratorio> {
  const row = await prisma.jsonStore.findUnique({
    where: { key: CONFIG_LAB_STORAGE_KEY },
  });
  if (!row) {
    throw new Error("Configure os dados do laboratório antes de emitir NFS-e.");
  }
  return JSON.parse(row.payload) as ConfigLaboratorio;
}

export async function emitirNfseParaCliente(params: {
  clienteId: string;
  valor: number;
  descricao?: string;
  lancamentoId?: string;
}) {
  const config = await carregarConfigNfse();
  if (!nfseConfigurada(config)) {
    throw new Error(
      config.provedor === "plugnotas"
        ? "Configure o token do PlugNotas em Configurações → Nota Fiscal."
        : "Configure Client ID e Secret da Nuvem Fiscal em Configurações → Nota Fiscal."
    );
  }

  const lab = await carregarLabServidor();
  const cliente = await prisma.cliente.findUnique({
    where: { id: params.clienteId },
  });
  if (!cliente) throw new Error("Cliente não encontrado.");

  const tomador: TomadorNfse = {
    nome: cliente.nome,
    cpfCnpj: cliente.cnpjCpf || "",
    email: cliente.email,
    cep: cliente.cep,
    rua: cliente.endereco?.split(",")[0] || cliente.endereco,
    cidade: cliente.cidade,
    uf: cliente.uf,
  };

  const registro = await prisma.nfseEmissao.create({
    data: {
      clienteId: cliente.id,
      lancamentoId: params.lancamentoId || null,
      valor: params.valor,
      descricao:
        params.descricao?.trim() ||
        config.descricaoServicoPadrao ||
        "Serviços de prótese dentária",
      status: "processando",
    },
  });

  try {
    const emitir =
      config.provedor === "plugnotas" ? emitirNfsePlugnotas : emitirNfseNuvemFiscal;
    const resultado = await emitir({
      config,
      lab,
      tomador,
      valor: params.valor,
      descricao: registro.descricao,
      referencia: registro.id,
    });

    const status =
      resultado.status === "autorizada" || resultado.status === "autorizado"
        ? "autorizada"
        : resultado.status === "erro" || resultado.status === "rejeitada"
          ? "erro"
          : "processando";

    return prisma.nfseEmissao.update({
      where: { id: registro.id },
      data: {
        status,
        providerId: resultado.providerId,
        numeroNfse: resultado.numeroNfse || null,
        codigoVerificacao: resultado.codigoVerificacao || null,
        pdfUrl: resultado.pdfUrl || null,
        mensagemErro:
          status === "erro"
            ? resultado.mensagens?.join("; ") || "Nota rejeitada pela prefeitura."
            : null,
      },
      include: { cliente: { select: { id: true, nome: true } } },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Falha ao emitir NFS-e.";
    return prisma.nfseEmissao.update({
      where: { id: registro.id },
      data: { status: "erro", mensagemErro: msg },
      include: { cliente: { select: { id: true, nome: true } } },
    });
  }
}
