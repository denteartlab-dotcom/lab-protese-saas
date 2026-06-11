import { prisma } from "@/lib/db";
import { garantirTokenAcompanhamentoCliente } from "@/lib/cliente-acompanhamento";
import { flagsUrgenciaTrabalho } from "@/lib/modulo-producao-os";
import { hrefAcompanhamentoClienteOs } from "@/lib/whatsapp";

export const LIMITE_URGENCIAS_ATIVAS_CLIENTE = 5;
export const LIMITE_URGENCIAS_DIA_CLIENTE = 2;
export const JSON_STORE_URGENCIAS_CLIENTE = "labProteseUrgenciasCliente";

/** Linha de auditoria gravada em instruções (legado — não exibir na observação da OS). */
export function isLinhaAuditoriaUrgenciaCliente(linha: string) {
  return linha.includes("Urgência solicitada pelo cliente");
}

const STATUS_FINALIZADOS = ["cancelado", "entregue", "finalizado"];

export type EventoUrgenciaCliente = {
  id: string;
  clienteId: string;
  trabalhoId: string;
  numeroOs: number;
  pacienteNome: string;
  clienteNome: string;
  tipoProtese: string;
  criadoEm: string;
};

type StoreUrgenciasCliente = {
  eventos: EventoUrgenciaCliente[];
};

export type UrgenteClienteDashboardItem = {
  id: string;
  trabalhoId: string;
  clienteId: string;
  numeroOs: number;
  clienteNome: string;
  pacienteNome: string;
  tipoProtese: string;
  criadoEm: string;
  linkAcompanhamento?: string;
};

export type LimitesUrgenciaCliente = {
  maxAtivos: number;
  maxPorDia: number;
  ativos: number;
  hoje: number;
};

function normDescricaoItem(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/^produto:\s*/i, "");
}

/** Marca ` - urgente` nas instruções da OS (mesmo padrão do controle de produção). */
export function marcarInstrucoesUrgente(
  instrucoes: string | null | undefined,
  tipoProtese: string
): string {
  const texto = instrucoes || "";
  if (flagsUrgenciaTrabalho({ tipoProtese, instrucoes: texto }).urgente) {
    return texto;
  }

  const linhas = texto ? texto.split("\n") : [];
  const itemIndices: number[] = [];
  linhas.forEach((line, i) => {
    if (line.trim().startsWith("Item adicionado:")) itemIndices.push(i);
  });

  const alvo = normDescricaoItem(tipoProtese || "");
  let alterou = false;

  const marcarLinha = (i: number) => {
    const line = linhas[i];
    if (/ - urgente(?: -|$)/i.test(line)) return;
    if (/ - obs /i.test(line)) {
      linhas[i] = line.replace(/ - obs /i, " - urgente - obs ");
    } else {
      linhas[i] = `${line.trimEnd()} - urgente`;
    }
    alterou = true;
  };

  if (itemIndices.length > 0) {
    const matchIdx = itemIndices.find((i) => {
      const m = linhas[i].match(/^Item adicionado:\s*(.*?)\s*-/i);
      const desc = normDescricaoItem(m?.[1] || "");
      return (
        desc === alvo ||
        (alvo.length > 2 && (desc.includes(alvo) || alvo.includes(desc)))
      );
    });
    const servicoIdx = itemIndices.find(
      (i) => !/^Item adicionado:\s*produto:/i.test(linhas[i])
    );
    marcarLinha(matchIdx ?? servicoIdx ?? itemIndices[0]);
  } else if (tipoProtese) {
    linhas.push(
      `Item adicionado: ${tipoProtese} - dentes - - cor - - qtd 1 - valor 0,00 - urgente`
    );
    alterou = true;
  }

  return alterou ? linhas.join("\n") : texto;
}

/** Remove marcação de urgência nas instruções (ao finalizar/entregar). */
export function removerMarcacaoUrgenteInstrucoes(
  instrucoes: string | null | undefined
): string {
  const linhas = (instrucoes || "")
    .split("\n")
    .filter((l) => !isLinhaAuditoriaUrgenciaCliente(l))
    .map((line) =>
      line
        .replace(/ - urgente - obs /gi, " - obs ")
        .replace(/ - urgente(?= -|$)/gi, "")
    );
  return linhas.join("\n").trimEnd();
}

export function inicioDiaBr(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function fimDiaBr(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function eventoNoDia(criadoEm: string, ref = new Date()) {
  const d = new Date(criadoEm);
  if (Number.isNaN(d.getTime())) return false;
  return d >= inicioDiaBr(ref) && d <= fimDiaBr(ref);
}

export async function carregarStoreUrgenciasCliente(): Promise<StoreUrgenciasCliente> {
  const row = await prisma.jsonStore.findUnique({
    where: { key: JSON_STORE_URGENCIAS_CLIENTE },
  });
  if (!row?.payload) return { eventos: [] };
  try {
    const parsed = JSON.parse(row.payload) as StoreUrgenciasCliente;
    if (parsed?.eventos && Array.isArray(parsed.eventos)) return parsed;
  } catch {
    /* ignora payload inválido */
  }
  return { eventos: [] };
}

export async function salvarStoreUrgenciasCliente(store: StoreUrgenciasCliente) {
  const payload = JSON.stringify(store);
  await prisma.jsonStore.upsert({
    where: { key: JSON_STORE_URGENCIAS_CLIENTE },
    create: { key: JSON_STORE_URGENCIAS_CLIENTE, payload },
    update: { payload },
  });
}

export function contarUrgenciasHojeCliente(
  eventos: EventoUrgenciaCliente[],
  clienteId: string,
  ref = new Date()
) {
  return eventos.filter(
    (e) => e.clienteId === clienteId && eventoNoDia(e.criadoEm, ref)
  ).length;
}

export function trabalhoAtivoUrgencia(status: string) {
  return !STATUS_FINALIZADOS.includes(status);
}

type TrabalhoUrgencia = {
  id: string;
  clienteId: string;
  status: string;
  tipoProtese: string;
  instrucoes?: string | null;
  numeroOs?: number;
};

export function contarUrgenciasAtivasOs(
  trabalhos: Array<{
    status: string;
    tipoProtese: string;
    instrucoes?: string | null;
    numeroOs?: number;
  }>
) {
  const numerosOs = new Set<number>();
  let count = 0;
  for (const t of trabalhos) {
    if (!trabalhoAtivoUrgencia(t.status)) continue;
    if (!flagsUrgenciaTrabalho(t).urgente) continue;
    const os = t.numeroOs;
    if (os != null) {
      if (numerosOs.has(os)) continue;
      numerosOs.add(os);
    }
    count++;
  }
  return count;
}

export function contarUrgenciasAtivasCliente(
  trabalhos: TrabalhoUrgencia[],
  clienteId: string
) {
  return contarUrgenciasAtivasOs(
    trabalhos.filter((t) => t.clienteId === clienteId)
  );
}

export function calcularLimitesUrgenciaCliente(
  eventos: EventoUrgenciaCliente[],
  trabalhos: TrabalhoUrgencia[],
  clienteId: string,
  acompanhamento = false
): LimitesUrgenciaCliente {
  return {
    maxAtivos: LIMITE_URGENCIAS_ATIVAS_CLIENTE,
    maxPorDia: LIMITE_URGENCIAS_DIA_CLIENTE,
    ativos: acompanhamento
      ? contarUrgenciasAtivasOs(trabalhos)
      : contarUrgenciasAtivasCliente(trabalhos, clienteId),
    hoje: contarUrgenciasHojeCliente(eventos, clienteId),
  };
}

export function trabalhoVisivelNoAcompanhamento(
  trabalho: { id: string; numeroOs: number },
  visiveis: Array<{ id: string; numeroOs: number }>
) {
  return visiveis.some(
    (t) => t.id === trabalho.id || t.numeroOs === trabalho.numeroOs
  );
}

export function montarUrgentesClienteDashboard(
  eventos: EventoUrgenciaCliente[],
  trabalhosPorId: Map<
    string,
    { status: string; tipoProtese: string; instrucoes?: string | null }
  >
): UrgenteClienteDashboardItem[] {
  const lista: UrgenteClienteDashboardItem[] = [];
  const vistos = new Set<string>();
  const ordenados = [...eventos].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));

  for (const e of ordenados) {
    const t = trabalhosPorId.get(e.trabalhoId);
    if (!t || !trabalhoAtivoUrgencia(t.status)) continue;
    if (
      !flagsUrgenciaTrabalho({
        tipoProtese: e.tipoProtese || t.tipoProtese,
        instrucoes: t.instrucoes,
      }).urgente
    ) {
      continue;
    }
    if (vistos.has(e.trabalhoId)) continue;
    vistos.add(e.trabalhoId);
    lista.push({
      id: e.id,
      trabalhoId: e.trabalhoId,
      clienteId: e.clienteId,
      numeroOs: e.numeroOs,
      clienteNome: e.clienteNome,
      pacienteNome: e.pacienteNome,
      tipoProtese: e.tipoProtese,
      criadoEm: e.criadoEm,
    });
  }

  return lista;
}

/** Remove eventos de OS finalizadas/entregues do histórico de urgências. */
export async function podarEventosUrgenciaInativos() {
  const store = await carregarStoreUrgenciasCliente();
  if (!store.eventos.length) return store;

  const ids = [...new Set(store.eventos.map((e) => e.trabalhoId))];
  const trabalhos = await prisma.trabalho.findMany({
    where: { id: { in: ids } },
    select: { id: true, status: true },
  });
  const statusPorId = new Map(trabalhos.map((t) => [t.id, t.status]));
  const eventos = store.eventos.filter((e) => {
    const status = statusPorId.get(e.trabalhoId);
    if (!status) return false;
    return trabalhoAtivoUrgencia(status);
  });

  if (eventos.length !== store.eventos.length) {
    const atualizado = { eventos };
    await salvarStoreUrgenciasCliente(atualizado);
    return atualizado;
  }
  return store;
}

/** Limpa urgência da OS e do registro quando finalizada ou entregue. */
export async function liberarUrgenciaTrabalhoFinalizado(numeroOs: number) {
  const trabalhos = await prisma.trabalho.findMany({
    where: { numeroOs },
    select: { id: true, instrucoes: true },
  });
  if (!trabalhos.length) return;

  const ids = new Set(trabalhos.map((t) => t.id));
  await prisma.$transaction(
    trabalhos.map((t) =>
      prisma.trabalho.update({
        where: { id: t.id },
        data: { instrucoes: removerMarcacaoUrgenteInstrucoes(t.instrucoes) },
      })
    )
  );

  const store = await carregarStoreUrgenciasCliente();
  const eventos = store.eventos.filter((e) => !ids.has(e.trabalhoId));
  if (eventos.length !== store.eventos.length) {
    await salvarStoreUrgenciasCliente({ eventos });
  }
}

export async function enriquecerLinksAcompanhamentoUrgentes(
  itens: UrgenteClienteDashboardItem[]
): Promise<UrgenteClienteDashboardItem[]> {
  if (!itens.length) return itens;

  const clienteIds = [...new Set(itens.map((i) => i.clienteId))];
  const clientes = await prisma.cliente.findMany({
    where: { id: { in: clienteIds } },
    select: { id: true, tokenAcompanhamento: true },
  });

  const tokenPorCliente = new Map<string, string>();
  for (const cliente of clientes) {
    const token = await garantirTokenAcompanhamentoCliente(
      cliente.id,
      cliente.tokenAcompanhamento
    );
    tokenPorCliente.set(cliente.id, token);
  }

  return itens.map((item) => {
    const token = tokenPorCliente.get(item.clienteId);
    return {
      ...item,
      linkAcompanhamento: token
        ? hrefAcompanhamentoClienteOs(token, item.numeroOs)
        : undefined,
    };
  });
}

type TrabalhoVisivelAcompanhamento = {
  id: string;
  numeroOs: number;
  status: string;
  tipoProtese: string;
  instrucoes: string | null;
};

export async function solicitarUrgenciaCliente(params: {
  cliente: { id: string; nome: string };
  trabalhoId: string;
  trabalhosVisiveis: TrabalhoVisivelAcompanhamento[];
}) {
  const trabalho = await prisma.trabalho.findUnique({
    where: { id: params.trabalhoId },
    include: { paciente: { select: { nome: true } } },
  });

  if (!trabalho) {
    return {
      ok: false as const,
      code: "nao_encontrado",
      message: "Trabalho não encontrado.",
    };
  }

  if (
    !trabalhoVisivelNoAcompanhamento(trabalho, params.trabalhosVisiveis)
  ) {
    return {
      ok: false as const,
      code: "nao_autorizado",
      message: "Este trabalho não pertence ao cliente.",
    };
  }

  if (!trabalhoAtivoUrgencia(trabalho.status)) {
    return {
      ok: false as const,
      code: "finalizado",
      message: "Este trabalho já foi finalizado.",
    };
  }

  const jaUrgente = flagsUrgenciaTrabalho(trabalho).urgente;
  const store = await carregarStoreUrgenciasCliente();

  if (!jaUrgente) {
    const hoje = contarUrgenciasHojeCliente(store.eventos, params.cliente.id);
    if (hoje >= LIMITE_URGENCIAS_DIA_CLIENTE) {
      return {
        ok: false as const,
        code: "limite_dia",
        message: `Você já sinalizou ${LIMITE_URGENCIAS_DIA_CLIENTE} trabalhos como urgentes hoje.`,
      };
    }

    const ativos = contarUrgenciasAtivasOs(params.trabalhosVisiveis);
    if (ativos >= LIMITE_URGENCIAS_ATIVAS_CLIENTE) {
      return {
        ok: false as const,
        code: "limite_ativo",
        message: `Limite de ${LIMITE_URGENCIAS_ATIVAS_CLIENTE} trabalhos urgentes ativos. Finalize um para liberar vaga.`,
      };
    }
  }

  const alvos = await prisma.trabalho.findMany({
    where: {
      numeroOs: trabalho.numeroOs,
      status: { notIn: STATUS_FINALIZADOS },
    },
  });

  await prisma.$transaction(
    alvos.map((t) => {
      const novasInstrucoes = marcarInstrucoesUrgente(
        t.instrucoes,
        t.tipoProtese || trabalho.tipoProtese
      );
      return prisma.trabalho.update({
        where: { id: t.id },
        data: { instrucoes: novasInstrucoes },
      });
    })
  );

  if (!jaUrgente) {
    const evento: EventoUrgenciaCliente = {
      id: `urg-${trabalho.id}-${Date.now()}`,
      clienteId: params.cliente.id,
      trabalhoId: trabalho.id,
      numeroOs: trabalho.numeroOs,
      pacienteNome: trabalho.paciente?.nome || "—",
      clienteNome: params.cliente.nome,
      tipoProtese: trabalho.tipoProtese,
      criadoEm: new Date().toISOString(),
    };
    store.eventos.push(evento);
    if (store.eventos.length > 500) {
      store.eventos = store.eventos.slice(-500);
    }
    await salvarStoreUrgenciasCliente(store);
    return { ok: true as const, evento, jaExistia: false };
  }

  return { ok: true as const, jaExistia: true };
}
