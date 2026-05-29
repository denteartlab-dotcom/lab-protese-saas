import {
  carregarEtapasCadastro,
  parseEtapasInstrucoes,
  type EtapaCadastro,
} from "@/lib/etapas-os";
import {
  trabalhoContaNoGraficoProducao,
  type TrabalhoProducaoResumo,
} from "@/lib/dashboard-producao";
import { carregarSetoresCadastro, type SetorCadastro } from "@/lib/setores-cadastro";

export const MESES_PRODUCAO_DASHBOARD = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

export const SETOR_OUTROS = "Outros";

export type TrabalhoProducaoSetorRef = TrabalhoProducaoResumo & {
  dataEntrada: string | Date;
  dataPrevista?: string | Date | null;
};

export type FatiaProducaoSetor = {
  nome: string;
  valor: number;
  cor: string;
};

export type ResumoProducaoMes = {
  entregues: number;
  atrasados: number;
  total: number;
};

function noMesAno(data: string | Date, mes: number, ano: number) {
  const d = new Date(data);
  return d.getMonth() === mes && d.getFullYear() === ano;
}

function mapaEtapaParaSetor(etapasCadastro: EtapaCadastro[]) {
  const mapa = new Map<string, string>();
  for (const etapa of etapasCadastro) {
    const nome = etapa.nome.trim();
    if (!nome) continue;
    mapa.set(nome.toLowerCase(), (etapa.setor || "").trim() || SETOR_OUTROS);
  }
  return mapa;
}

export function trabalhosNoMesProducao(
  trabalhos: TrabalhoProducaoSetorRef[],
  mes: number,
  ano: number
) {
  return trabalhos.filter((t) => {
    if (t.status === "cancelado") return false;
    if (!trabalhoContaNoGraficoProducao(t)) return false;
    return noMesAno(t.dataEntrada, mes, ano);
  });
}

export function calcularResumoProducaoMes(
  trabalhos: TrabalhoProducaoSetorRef[],
  mes: number,
  ano: number
): ResumoProducaoMes {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  let entregues = 0;
  let atrasados = 0;

  for (const t of trabalhosNoMesProducao(trabalhos, mes, ano)) {
    if (["entregue", "finalizado", "saiu_entrega"].includes(t.status)) {
      entregues += 1;
      continue;
    }
    const prevista = t.dataPrevista ? new Date(t.dataPrevista) : null;
    if (prevista) {
      prevista.setHours(0, 0, 0, 0);
      if (prevista < hoje) atrasados += 1;
    }
  }

  return {
    entregues,
    atrasados,
    total: entregues + atrasados,
  };
}

/** Contagem de OS no mês por setor (via etapas da OS + cadastro de etapas). */
export function calcularProducaoPorSetor(
  trabalhos: TrabalhoProducaoSetorRef[],
  mes: number,
  ano: number,
  setores: SetorCadastro[],
  etapasCadastro?: EtapaCadastro[]
): FatiaProducaoSetor[] {
  const etapas = etapasCadastro ?? carregarEtapasCadastro();
  const mapaSetor = mapaEtapaParaSetor(etapas);
  const contagem = new Map<string, number>();

  for (const setor of setores) {
    contagem.set(setor.nome.trim(), 0);
  }
  contagem.set(SETOR_OUTROS, 0);

  const corPorNome = new Map<string, string>();
  for (const setor of setores) {
    corPorNome.set(setor.nome.trim(), setor.cor || "#9b59b6");
  }
  corPorNome.set(SETOR_OUTROS, "#42a5f5");

  for (const t of trabalhosNoMesProducao(trabalhos, mes, ano)) {
    const etapasOs = parseEtapasInstrucoes(t.instrucoes);
    if (!etapasOs.length) {
      contagem.set(SETOR_OUTROS, (contagem.get(SETOR_OUTROS) || 0) + 1);
      continue;
    }

    const setoresNaOs = new Set<string>();
    for (const etapa of etapasOs) {
      const nomeEtapa = etapa.nome.trim();
      if (!nomeEtapa) continue;
      let setor =
        mapaSetor.get(nomeEtapa.toLowerCase()) ||
        mapaSetor.get(nomeEtapa.trim()) ||
        SETOR_OUTROS;
      if (!contagem.has(setor)) setor = SETOR_OUTROS;
      setoresNaOs.add(setor);
    }

    for (const setor of setoresNaOs) {
      contagem.set(setor, (contagem.get(setor) || 0) + 1);
    }
  }

  const nomesOrdenados = [
    ...setores.map((s) => s.nome.trim()).filter(Boolean),
    ...(contagem.has(SETOR_OUTROS) || (contagem.get(SETOR_OUTROS) || 0) > 0
      ? [SETOR_OUTROS]
      : []),
  ];

  const vistas = new Set<string>();
  const fatias: FatiaProducaoSetor[] = [];

  for (const nome of nomesOrdenados) {
    if (vistas.has(nome)) continue;
    vistas.add(nome);
    fatias.push({
      nome,
      valor: contagem.get(nome) || 0,
      cor: corPorNome.get(nome) || "#9b59b6",
    });
  }

  const comValor = fatias.filter((f) => f.valor > 0);
  return comValor.length ? comValor : fatias;
}

export function carregarCadastrosProducaoSetores() {
  return {
    setores: carregarSetoresCadastro(),
    etapas: carregarEtapasCadastro(),
  };
}
