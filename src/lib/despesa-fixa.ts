import { brShortToIso, dateToBrShort, parseBrDate } from "@/lib/datas-br";
import {
  desempacotarDespesa,
  descricaoDespesaComParcela,
  empacotarDespesa,
  atualizarMetaDespesa,
  type DespesaMeta,
} from "@/lib/lancamento-despesa";

/** Intervalo em dias entre parcelas da mesma instância mensal. */
export const INTERVALO_DIAS_PARCELA_DESPESA_FIXA = 30;

/** Mantido por compatibilidade — a sincronização gera só o mês corrente. */
export const MESES_AVANCO_DESPESA_FIXA = 1;

export type LancamentoDespesaFixa = {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  status: string;
  formaPagamento?: string | null;
};

export type ParcelaDespesaFixaPayload = {
  parcela: string;
  valor: number;
  vencimento: string;
  status: "pendente" | "pago";
  formaPagamento: string;
  conta: string;
  codigoBarrasPix?: string;
};

export type TemplateDespesaFixa = {
  grupoId: string;
  textoBase: string;
  metaBase: DespesaMeta;
  diaVencimento: number;
  parcelas: ParcelaDespesaFixaPayload[];
};

export function gerarGrupoDespesaFixaId() {
  return `fixa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function mesReferenciaDeDataBr(dataBr: string) {
  const iso = brShortToIso(dataBr);
  return iso ? iso.slice(0, 7) : mesReferenciaAtual();
}

export function mesReferenciaDeIso(iso: string) {
  const match = String(iso).match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : mesReferenciaAtual();
}

export function mesReferenciaAtual() {
  const hoje = new Date();
  const y = hoje.getFullYear();
  const m = String(hoje.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function compararMesReferencia(a: string, b: string) {
  return a.localeCompare(b);
}

export function mesReferenciaEhFuturo(
  mesReferencia: string,
  referencia = mesReferenciaAtual()
) {
  return compararMesReferencia(mesReferencia, referencia) > 0;
}

/** Mês de referência de uma instância de despesa fixa (YYYY-MM). */
export function mesInstanciaDespesaFixa(item: LancamentoDespesaFixa) {
  const pack = desempacotarDespesa(item.descricao);
  if (!pack.meta.fixa || !pack.meta.fixaGrupoId) return null;
  return pack.meta.fixaMes || mesReferenciaDeIso(item.data);
}

export function mesReferenciaDeVencimentoIso(dataIso: string) {
  return mesReferenciaDeIso(dataIso);
}

/** Mês efetivo da instância: meta fixaMes ou, se ausente, mês do vencimento. */
export function mesEfetivoInstanciaDespesaFixa(item: LancamentoDespesaFixa) {
  return mesInstanciaDespesaFixa(item) || mesReferenciaDeVencimentoIso(item.data);
}

/**
 * Instância de mês futuro (ex.: agosto gerado indevidamente em julho).
 * Meses passados em atraso NÃO são removidos — ficam até serem pagos.
 */
export function instanciaFixaEhFutura(
  item: LancamentoDespesaFixa,
  referencia = mesReferenciaAtual()
) {
  const pack = desempacotarDespesa(item.descricao);
  if (!pack.meta.fixa || !pack.meta.fixaGrupoId) return false;

  const mesInstancia = mesEfetivoInstanciaDespesaFixa(item);
  return mesReferenciaEhFuturo(mesInstancia, referencia);
}

export function mesPrimeiraInstanciaGrupoFixa(
  lancamentos: LancamentoDespesaFixa[],
  grupoId: string
) {
  let menor: string | null = null;
  for (const item of lancamentos) {
    const pack = desempacotarDespesa(item.descricao);
    if (pack.meta.fixaGrupoId !== grupoId) continue;
    const mes = mesEfetivoInstanciaDespesaFixa(item);
    if (!menor || compararMesReferencia(mes, menor) < 0) menor = mes;
  }
  return menor;
}

/**
 * Despesa fixa gera no máximo uma instância por mês, somente no mês vigente.
 * Meses anteriores em atraso permanecem na lista até o pagamento.
 */
export function podeGerarInstanciaFixaMesCorrente(
  mesReferencia: string,
  lancamentos: LancamentoDespesaFixa[],
  grupoId: string
) {
  const mesAtual = mesReferenciaAtual();
  if (mesReferencia !== mesAtual) return false;

  const mesPrimeiro = mesPrimeiraInstanciaGrupoFixa(lancamentos, grupoId);
  if (!mesPrimeiro) return false;
  if (compararMesReferencia(mesAtual, mesPrimeiro) < 0) return false;
  if (grupoFixaTemInstanciaNoMes(lancamentos, grupoId, mesAtual)) return false;

  return true;
}

/** Duplicatas do mesmo grupo no mesmo mês — mantém a instância mais antiga (ou paga). */
export function idsInstanciasFixasDuplicadas(lancamentos: LancamentoDespesaFixa[]) {
  const porChave = new Map<string, LancamentoDespesaFixa[]>();

  for (const item of lancamentos) {
    const pack = desempacotarDespesa(item.descricao);
    if (!pack.meta.fixa || !pack.meta.fixaGrupoId || pack.meta.fixaAtiva === false) {
      continue;
    }

    const mes = mesEfetivoInstanciaDespesaFixa(item);
    const chave = `${pack.meta.fixaGrupoId}:${mes}`;
    const lista = porChave.get(chave) || [];
    lista.push(item);
    porChave.set(chave, lista);
  }

  const duplicados: string[] = [];

  for (const instancias of porChave.values()) {
    if (instancias.length <= 1) continue;

    const ordenadas = [...instancias].sort((a, b) => {
      const aPago = a.status === "pago" ? 0 : 1;
      const bPago = b.status === "pago" ? 0 : 1;
      if (aPago !== bPago) return aPago - bPago;
      return a.id.localeCompare(b.id);
    });

    for (const extra of ordenadas.slice(1)) {
      duplicados.push(extra.id);
    }
  }

  return duplicados;
}

export function listarMesesReferencia(mesInicial: string, quantidade: number) {
  const [anoStr, mesStr] = mesInicial.split("-");
  let ano = Number(anoStr);
  let mes = Number(mesStr);
  if (!Number.isFinite(ano) || !Number.isFinite(mes)) return [mesReferenciaAtual()];

  const lista: string[] = [];
  for (let i = 0; i < quantidade; i++) {
    lista.push(`${ano}-${String(mes).padStart(2, "0")}`);
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
  }
  return lista;
}

export function vencimentoParcelaNoMes(
  mesReferencia: string,
  diaPreferido: number,
  indiceParcela: number
) {
  const [anoStr, mesStr] = mesReferencia.split("-");
  const ano = Number(anoStr);
  const mes = Number(mesStr);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const dia = Math.min(Math.max(diaPreferido, 1), ultimoDia);
  const data = new Date(ano, mes - 1, dia);

  if (indiceParcela > 0) {
    data.setDate(
      data.getDate() + indiceParcela * INTERVALO_DIAS_PARCELA_DESPESA_FIXA
    );
    const mesResultado = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
    if (mesResultado !== mesReferencia) {
      return vencimentoParcelaNoMes(mesReferencia, diaPreferido, 0);
    }
  }

  return dateToBrShort(data);
}

export function extrairGruposDespesaFixaAtivos(lancamentos: LancamentoDespesaFixa[]) {
  const grupos = new Set<string>();
  for (const item of lancamentos) {
    const pack = desempacotarDespesa(item.descricao);
    if (pack.meta.fixa && pack.meta.fixaGrupoId && pack.meta.fixaAtiva !== false) {
      grupos.add(pack.meta.fixaGrupoId);
    }
  }
  return Array.from(grupos);
}

export function grupoFixaTemInstanciaNoMes(
  lancamentos: LancamentoDespesaFixa[],
  grupoId: string,
  mesReferencia: string
) {
  return lancamentos.some((item) => {
    const pack = desempacotarDespesa(item.descricao);
    if (pack.meta.fixaGrupoId !== grupoId) return false;
    return mesEfetivoInstanciaDespesaFixa(item) === mesReferencia;
  });
}

export function mesesIgnoradosGrupoFixa(
  lancamentos: LancamentoDespesaFixa[],
  grupoId: string
) {
  const meses = new Set<string>();
  for (const item of lancamentos) {
    const pack = desempacotarDespesa(item.descricao);
    if (pack.meta.fixaGrupoId !== grupoId) continue;
    for (const mes of pack.meta.fixaMesesIgnorados || []) {
      if (mes) meses.add(mes);
    }
  }
  return [...meses];
}

export function mesIgnoradoDespesaFixa(
  lancamentos: LancamentoDespesaFixa[],
  grupoId: string,
  mesReferencia: string
) {
  return mesesIgnoradosGrupoFixa(lancamentos, grupoId).includes(mesReferencia);
}

/** Marca o mês como excluído no grupo para a sincronização não recriar a instância. */
export async function registrarMesIgnoradoDespesaFixaGrupo(
  lancamentos: LancamentoDespesaFixa[],
  grupoId: string,
  mesReferencia: string,
  excetoId?: string
) {
  const meses = [...mesesIgnoradosGrupoFixa(lancamentos, grupoId)];
  if (!meses.includes(mesReferencia)) meses.push(mesReferencia);

  const alvos = lancamentos.filter((item) => {
    if (excetoId && item.id === excetoId) return false;
    const pack = desempacotarDespesa(item.descricao);
    return pack.meta.fixaGrupoId === grupoId;
  });

  for (const alvo of alvos) {
    const res = await fetch(`/api/financeiro/${alvo.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        descricao: atualizarMetaDespesa(alvo.descricao, {
          fixaMesesIgnorados: meses,
        }),
      }),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(json.error || "Não foi possível atualizar a despesa fixa.");
    }
  }
}

function numeroParcela(texto: string, parcelaMeta: string) {
  const match = texto.match(/\((\d+)\s*\/\s*(\d+)\)/);
  if (match) {
    return {
      numero: Number(match[1]) || 1,
      total: Number(match[2]) || 1,
      rotulo: `${match[1]}/${match[2]}`,
    };
  }
  const total = Number.parseInt(parcelaMeta, 10);
  if (Number.isFinite(total) && total > 1) {
    return { numero: 1, total, rotulo: `1/${total}` };
  }
  return { numero: 1, total: 1, rotulo: "1/1" };
}

function dataIsoParaBr(iso: string) {
  const match = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function extrairTemplateDespesaFixa(
  lancamentos: LancamentoDespesaFixa[],
  grupoId: string
): TemplateDespesaFixa | null {
  const doGrupo = lancamentos.filter((item) => {
    const pack = desempacotarDespesa(item.descricao);
    return pack.meta.fixaGrupoId === grupoId && pack.meta.fixa;
  });
  if (!doGrupo.length) return null;

  const porMes = new Map<string, LancamentoDespesaFixa[]>();
  for (const item of doGrupo) {
    const pack = desempacotarDespesa(item.descricao);
    const mes = pack.meta.fixaMes || mesReferenciaDeIso(item.data);
    const lista = porMes.get(mes) || [];
    lista.push(item);
    porMes.set(mes, lista);
  }

  const mesTemplate = [...porMes.keys()].sort()[0];
  const instancias = porMes.get(mesTemplate) || [];
  const ordenadas = instancias
    .map((item) => {
      const pack = desempacotarDespesa(item.descricao);
      const parcela = numeroParcela(pack.texto, pack.parcela);
      return { item, pack, parcela };
    })
    .sort((a, b) => a.parcela.numero - b.parcela.numero);

  const referencia = ordenadas[0];
  if (!referencia) return null;

  const textoSemParcela = referencia.pack.texto
    .replace(/\s*\(\d+\s*\/\s*\d+\)\s*$/, "")
    .trim();
  const diaVencimento =
    referencia.pack.meta.fixaDiaVencimento ||
    parseBrDate(dataIsoParaBr(referencia.item.data))?.getDate() ||
    1;

  const parcelas: ParcelaDespesaFixaPayload[] = ordenadas.map(({ item, pack, parcela }, index) => ({
    parcela: parcela.rotulo,
    valor: item.valor,
    vencimento: dataIsoParaBr(item.data),
    status: item.status === "pago" ? "pago" : "pendente",
    formaPagamento: item.formaPagamento?.trim() || "Pix",
    conta: pack.conta === "—" ? "Caixa Principal" : pack.conta,
    codigoBarrasPix: "",
  }));

  const { fixaGrupoId, fixa, fixaAtiva, fixaMes, fixaDiaVencimento, fixaMesesIgnorados, ...metaResto } =
    referencia.pack.meta;

  const mesesIgnorados = new Set<string>(fixaMesesIgnorados || []);
  for (const item of doGrupo) {
    const pack = desempacotarDespesa(item.descricao);
    for (const mes of pack.meta.fixaMesesIgnorados || []) {
      if (mes) mesesIgnorados.add(mes);
    }
  }

  return {
    grupoId,
    textoBase: textoSemParcela,
    metaBase: {
      ...metaResto,
      ...(mesesIgnorados.size ? { fixaMesesIgnorados: [...mesesIgnorados] } : {}),
    },
    diaVencimento,
    parcelas,
  };
}

export function montarDescricaoInstanciaFixa(
  template: TemplateDespesaFixa,
  mesReferencia: string,
  parcela: ParcelaDespesaFixaPayload
) {
  const meta: DespesaMeta = {
    ...template.metaBase,
    fixa: true,
    fixaAtiva: true,
    fixaGrupoId: template.grupoId,
    fixaMes: mesReferencia,
    fixaDiaVencimento: template.diaVencimento,
    conta: parcela.conta,
    parcela: String(template.parcelas.length),
  };
  const base = empacotarDespesa(template.textoBase, meta);
  return descricaoDespesaComParcela(base, parcela.parcela);
}

export function parcelasInstanciaFixaNoMes(
  template: TemplateDespesaFixa,
  mesReferencia: string
): ParcelaDespesaFixaPayload[] {
  return template.parcelas.map((parcela, index) => ({
    ...parcela,
    vencimento: vencimentoParcelaNoMes(
      mesReferencia,
      template.diaVencimento,
      index
    ),
    status: "pendente",
  }));
}

export function metaDespesaFixa(
  meta: DespesaMeta,
  grupoId: string,
  mesReferencia: string,
  diaVencimento: number
): DespesaMeta {
  return {
    ...meta,
    fixa: true,
    fixaAtiva: true,
    fixaGrupoId: grupoId,
    fixaMes: mesReferencia,
    fixaDiaVencimento: diaVencimento,
  };
}

type ParcelaApiDespesa = {
  valor: number;
  data: string;
  status: "pendente" | "pago";
  formaPagamento: string;
  parcelaLabel: string;
};

async function criarDespesaApiRemoto(
  descricaoBase: string,
  parcelasApi: ParcelaApiDespesa[]
) {
  if (parcelasApi.length === 0) return;

  if (parcelasApi.length === 1) {
    const parcela = parcelasApi[0];
    const partes = parcela.parcelaLabel.split("/").map((x) => Number(x.trim()));
    const res = await fetch("/api/financeiro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "despesa",
        descricao: descricaoDespesaComParcela(descricaoBase, parcela.parcelaLabel),
        valor: parcela.valor,
        data: parcela.data,
        status: parcela.status,
        formaPagamento: parcela.formaPagamento,
        parcelaNumero: partes[0] || 1,
        parcelaTotal: partes[1] || 1,
      }),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(json.error || "Não foi possível salvar a despesa fixa.");
    }
    return;
  }

  const res = await fetch("/api/financeiro", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tipo: "despesa",
      descricao: descricaoBase,
      valor: parcelasApi[0].valor,
      parcelas: parcelasApi.map(({ parcelaLabel: _p, ...rest }) => rest),
    }),
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error || "Não foi possível salvar a despesa fixa.");
  }
}

export function idsInstanciasFixasIndevidas(lancamentos: LancamentoDespesaFixa[]) {
  const ids = new Set<string>();
  for (const item of lancamentos) {
    const pack = desempacotarDespesa(item.descricao);
    if (!pack.meta.fixa || pack.meta.fixaAtiva === false) continue;
    if (instanciaFixaEhFutura(item)) ids.add(item.id);
  }
  for (const id of idsInstanciasFixasDuplicadas(lancamentos)) {
    ids.add(id);
  }
  return [...ids];
}

/** Remove instâncias futuras e duplicatas geradas indevidamente. */
export async function limparInstanciasFixasFuturasRemoto(
  lancamentos: LancamentoDespesaFixa[]
) {
  let removidos = 0;
  for (const id of idsInstanciasFixasIndevidas(lancamentos)) {
    const res = await fetch(`/api/financeiro/${id}`, { method: "DELETE" });
    if (res.ok) removidos += 1;
  }
  return removidos;
}

/** Gera a instância do mês corrente para despesas fixas ativas (virada de mês). */
export async function sincronizarDespesasFixaRemoto(
  lancamentos: LancamentoDespesaFixa[]
) {
  const grupos = extrairGruposDespesaFixaAtivos(lancamentos);
  if (!grupos.length) return 0;

  let criados = 0;
  const mesAtual = mesReferenciaAtual();

  for (const grupoId of grupos) {
    const template = extrairTemplateDespesaFixa(lancamentos, grupoId);
    if (!template) continue;

    if (!podeGerarInstanciaFixaMesCorrente(mesAtual, lancamentos, grupoId)) continue;
    if (mesIgnoradoDespesaFixa(lancamentos, grupoId, mesAtual)) continue;

    const parcelasMes = parcelasInstanciaFixaNoMes(template, mesAtual);
    if (!parcelasMes.length) continue;

    if (parcelasMes.length === 1) {
      const parcela = parcelasMes[0];
      await criarDespesaApiRemoto(
        empacotarDespesa(
          template.textoBase,
          metaDespesaFixa(
            {
              ...template.metaBase,
              conta: parcela.conta,
              parcela: "1",
            },
            template.grupoId,
            mesAtual,
            template.diaVencimento
          )
        ),
        [
          {
            valor: parcela.valor,
            data: brShortToIso(parcela.vencimento),
            status: "pendente",
            formaPagamento: parcela.formaPagamento,
            parcelaLabel: parcela.parcela,
          },
        ]
      );
      criados += 1;
    } else {
      const descricaoBase = empacotarDespesa(
        template.textoBase,
        metaDespesaFixa(
          {
            ...template.metaBase,
            conta: parcelasMes[0].conta,
            parcela: String(parcelasMes.length),
          },
          template.grupoId,
          mesAtual,
          template.diaVencimento
        )
      );
      await criarDespesaApiRemoto(
        descricaoBase,
        parcelasMes.map((parcela, index) => ({
          valor: parcela.valor,
          data: brShortToIso(
            vencimentoParcelaNoMes(mesAtual, template.diaVencimento, index)
          ),
          status: "pendente" as const,
          formaPagamento: parcela.formaPagamento,
          parcelaLabel: parcela.parcela,
        }))
      );
      criados += parcelasMes.length;
    }
  }

  return criados;
}
