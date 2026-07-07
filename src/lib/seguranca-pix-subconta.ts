import { prisma } from "@/lib/db";

const TTL_MS = 15 * 60 * 1000;
const PREFIX_PENDENTE = "pixPendente:";
const PREFIX_MAPA_ASAAS = "pixAsaasAut:";

export type PixPendenteSubconta = {
  empresaId: string;
  usuarioId: string;
  valor: number;
  chavePix: string;
  tipoChave: string;
  autorizadoEm: string;
  expiraEm: string;
  asaasTransferId?: string;
  status: "pendente" | "enviado" | "aprovado_webhook" | "recusado_webhook";
};

type MapaAsaasPix = {
  pendingId: string;
  empresaId: string;
};

async function lerJsonStoreGlobal<T>(key: string): Promise<T | null> {
  const row = await prisma.jsonStore.findUnique({ where: { key } });
  if (!row?.payload) return null;
  try {
    return JSON.parse(row.payload) as T;
  } catch {
    return null;
  }
}

async function gravarJsonStoreGlobal(key: string, valor: unknown) {
  const payload = JSON.stringify(valor);
  await prisma.jsonStore.upsert({
    where: { key },
    create: { key, payload },
    update: { payload },
  });
}

async function excluirJsonStoreGlobal(key: string) {
  await prisma.jsonStore.deleteMany({ where: { key } });
}

export async function criarAutorizacaoPixSubconta(params: {
  empresaId: string;
  usuarioId: string;
  valor: number;
  chavePix: string;
  tipoChave: string;
}) {
  const id = crypto.randomUUID();
  const agora = new Date();
  const registro: PixPendenteSubconta = {
    empresaId: params.empresaId,
    usuarioId: params.usuarioId,
    valor: Number(params.valor.toFixed(2)),
    chavePix: params.chavePix.trim(),
    tipoChave: params.tipoChave,
    autorizadoEm: agora.toISOString(),
    expiraEm: new Date(agora.getTime() + TTL_MS).toISOString(),
    status: "pendente",
  };
  await gravarJsonStoreGlobal(`${PREFIX_PENDENTE}${id}`, registro);
  return id;
}

export async function vincularTransferenciaAsaas(pendingId: string, asaasTransferId: string) {
  const chavePendente = `${PREFIX_PENDENTE}${pendingId}`;
  const registro = await lerJsonStoreGlobal<PixPendenteSubconta>(chavePendente);
  if (!registro) {
    throw new Error("Autorização Pix não encontrada.");
  }

  registro.asaasTransferId = asaasTransferId;
  registro.status = "enviado";
  await gravarJsonStoreGlobal(chavePendente, registro);
  await gravarJsonStoreGlobal(`${PREFIX_MAPA_ASAAS}${asaasTransferId}`, {
    pendingId,
    empresaId: registro.empresaId,
  } satisfies MapaAsaasPix);
}

type PayloadAutorizacaoSaque = {
  type?: string;
  transfer?: {
    id?: string;
    value?: number;
    operationType?: string;
    status?: string;
    bankAccount?: { pixAddressKey?: string | null };
  };
};

export async function avaliarAutorizacaoSaqueAsaas(
  payload: PayloadAutorizacaoSaque
): Promise<{ status: "APPROVED" | "REFUSED"; refuseReason?: string }> {
  if (payload.type !== "TRANSFER") {
    return { status: "REFUSED", refuseReason: "Tipo de operação não suportado." };
  }

  const transfer = payload.transfer;
  const transferId = transfer?.id?.trim();
  if (!transferId) {
    return { status: "REFUSED", refuseReason: "Transferência sem identificador." };
  }

  const mapa = await lerJsonStoreGlobal<MapaAsaasPix>(`${PREFIX_MAPA_ASAAS}${transferId}`);
  if (!mapa?.pendingId) {
    return {
      status: "REFUSED",
      refuseReason: "Transferência não reconhecida pelo Lab Prótese.",
    };
  }

  const registro = await lerJsonStoreGlobal<PixPendenteSubconta>(
    `${PREFIX_PENDENTE}${mapa.pendingId}`
  );
  if (!registro || registro.empresaId !== mapa.empresaId) {
    return { status: "REFUSED", refuseReason: "Autorização Pix inválida." };
  }

  if (registro.status !== "enviado") {
    return { status: "REFUSED", refuseReason: "Autorização Pix já utilizada ou pendente." };
  }

  if (Date.now() > new Date(registro.expiraEm).getTime()) {
    registro.status = "recusado_webhook";
    await gravarJsonStoreGlobal(`${PREFIX_PENDENTE}${mapa.pendingId}`, registro);
    return { status: "REFUSED", refuseReason: "Autorização Pix expirada." };
  }

  const valorAsaas = Number(transfer?.value) || 0;
  if (Math.abs(valorAsaas - registro.valor) > 0.01) {
    return { status: "REFUSED", refuseReason: "Valor divergente da solicitação." };
  }

  if ((transfer?.operationType || "").toUpperCase() !== "PIX") {
    return { status: "REFUSED", refuseReason: "Operação não é Pix." };
  }

  const chaveAsaas = transfer.bankAccount?.pixAddressKey?.trim();
  if (
    chaveAsaas &&
    chaveAsaas.toLowerCase() !== registro.chavePix.trim().toLowerCase()
  ) {
    return { status: "REFUSED", refuseReason: "Chave Pix divergente da solicitação." };
  }

  registro.status = "aprovado_webhook";
  await gravarJsonStoreGlobal(`${PREFIX_PENDENTE}${mapa.pendingId}`, registro);

  return { status: "APPROVED" };
}

/** Remove registros antigos (best-effort). */
export async function limparAutorizacoesPixExpiradas() {
  const rows = await prisma.jsonStore.findMany({
    where: { key: { startsWith: PREFIX_PENDENTE } },
    select: { key: true, payload: true },
  });
  const agora = Date.now();
  for (const row of rows) {
    try {
      const registro = JSON.parse(row.payload) as PixPendenteSubconta;
      if (new Date(registro.expiraEm).getTime() < agora) {
        await excluirJsonStoreGlobal(row.key);
        if (registro.asaasTransferId) {
          await excluirJsonStoreGlobal(`${PREFIX_MAPA_ASAAS}${registro.asaasTransferId}`);
        }
      }
    } catch {
      /* ignora */
    }
  }
}
