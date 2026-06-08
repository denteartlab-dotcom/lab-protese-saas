import { readStorage } from "@/lib/persisted-storage";
import { calcularDataVencimentoPorDias } from "@/lib/prazos-servico";

export const ETAPAS_STORAGE_KEY = "labProteseEtapas";

export type EtapaCadastro = {
  id: string;
  nome: string;
  setor?: string;
  /** Cor de fundo do nome da etapa (hex). */
  cor?: string;
  tempoMedio?: string;
  calculoPorElemento?: string;
  /** Prazo de vencimento da etapa em dias (contado a partir da data de lançamento da OS). */
  prazoDias?: string;
};

/** Cor de fundo da etapa; usa fallback do setor se não definida. */
export function corFundoEtapa(etapa: EtapaCadastro, corSetorFallback?: string) {
  const cor = etapa.cor?.trim();
  if (cor && /^#[0-9a-fA-F]{6}$/.test(cor)) return cor;
  if (corSetorFallback && /^#[0-9a-fA-F]{6}$/.test(corSetorFallback)) return corSetorFallback;
  return "#f9a8d4";
}

export function corTextoSobreFundo(hex: string) {
  const limpo = hex.replace("#", "");
  if (limpo.length !== 6) return "#374151";
  const r = Number.parseInt(limpo.slice(0, 2), 16);
  const g = Number.parseInt(limpo.slice(2, 4), 16);
  const b = Number.parseInt(limpo.slice(4, 6), 16);
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminancia > 0.62 ? "#374151" : "#ffffff";
}

export type EtapaOsLinha = {
  /** Índice estável na lista de etapas da OS */
  indice: number;
  nome: string;
  responsavel: string;
  prazo: string;
  observacao: string;
  /** Texto após "tempo" na linha da OS (ex.: "30 min"). */
  tempo?: string;
};

const etapasPadrao: EtapaCadastro[] = [
  { id: "modelo-individual", nome: "Modelo Individual", setor: "Resina" },
  { id: "montagem", nome: "Montagem", setor: "Resina" },
  { id: "acrilizacao-caracterizada", nome: "Acrilização caracterizada", setor: "Resina" },
];

export function carregarEtapasCadastro(): EtapaCadastro[] {
  const lista = readStorage<EtapaCadastro[]>(ETAPAS_STORAGE_KEY, etapasPadrao);
  return lista.filter((e) => e?.nome?.trim());
}

/** Data de vencimento (dd/mm/aaaa) da etapa com base na data de lançamento da OS. */
export function prazoVencimentoEtapaOs(dataLancamentoBr: string, prazoDias?: string | null) {
  return calcularDataVencimentoPorDias(dataLancamentoBr, prazoDias);
}

/** Remove sufixo visual " — Setor" (ex.: "Plano de cera — Resina" → "Plano de cera"). */
export function nomeEtapaSemSetor(nome: string) {
  const texto = nome.trim();
  const separador = texto.indexOf(" — ");
  return separador >= 0 ? texto.slice(0, separador).trim() : texto;
}

/** Nome da etapa alinhado ao cadastro (sem sufixo de setor no rótulo). */
export function normalizarNomeEtapaCadastro(
  nome: string,
  cadastro?: EtapaCadastro[]
) {
  const limpo = nomeEtapaSemSetor(nome);
  const modelos = cadastro ?? carregarEtapasCadastro();
  const exato = modelos.find(
    (m) => m.nome === limpo || m.nome === nome.trim() || nomeEtapaSemSetor(m.nome) === limpo
  );
  return exato?.nome ?? limpo;
}

function parseRestoEtapa(resto: string) {
  let responsavel = "";
  let prazo = "";
  let tempo = "";
  const observacoes: string[] = [];

  for (const parte of resto.split(" - ").map((p) => p.trim()).filter(Boolean)) {
    if (/^resp\./i.test(parte)) {
      responsavel = parte.replace(/^resp\.\s*/i, "").trim();
    } else if (/^tempo\s+/i.test(parte)) {
      tempo = parte.replace(/^tempo\s+/i, "").trim();
    } else if (/^prazo\s+/i.test(parte)) {
      prazo = parte.replace(/^prazo\s*/i, "").trim();
    } else {
      observacoes.push(parte);
    }
  }

  return {
    responsavel,
    prazo,
    tempo,
    observacao: observacoes.join(" - "),
  };
}

/** Converte texto de tempo da etapa (ex.: "30 min") em minutos. */
export function tempoMinutosEtapa(tempo?: string, tempoMedioCadastro?: string) {
  const fonte = (tempo || tempoMedioCadastro || "").trim().toLowerCase();
  if (!fonte) return 0;
  const match = fonte.match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return 0;
  const valor = Number(match[1].replace(",", "."));
  if (!Number.isFinite(valor)) return 0;
  if (/h|hora/.test(fonte)) return Math.round(valor * 60);
  return Math.round(valor);
}

export function parseEtapasInstrucoes(instrucoes?: string | null): EtapaOsLinha[] {
  const linhas = (instrucoes || "").split("\n");
  const etapas: EtapaOsLinha[] = [];

  linhas.forEach((line) => {
    const match = line.trim().match(/^Etapa\s+(.+?):\s*(.*)$/i);
    if (!match) return;
    const nome = normalizarNomeEtapaCadastro(match[1].trim());
    const resto = parseRestoEtapa(match[2] || "");
    etapas.push({
      indice: etapas.length,
      nome,
      ...resto,
    });
  });

  return etapas;
}

export function formatarLinhaEtapa(etapa: Pick<EtapaOsLinha, "nome" | "responsavel" | "prazo" | "observacao">) {
  if (!etapa.nome.trim()) return "";
  const partes = [
    etapa.responsavel.trim() && `resp. ${etapa.responsavel.trim()}`,
    etapa.prazo.trim() && `prazo ${etapa.prazo.trim()}`,
    etapa.observacao.trim(),
  ].filter(Boolean);
  return `Etapa ${etapa.nome.trim()}: ${partes.join(" - ")}`;
}

export function formatarLinhaEtapaComTempo(
  etapa: Pick<EtapaOsLinha, "nome" | "responsavel" | "prazo" | "observacao">,
  tempo?: string
) {
  if (!etapa.nome.trim()) return "";
  const partes = [
    etapa.responsavel.trim() && `resp. ${etapa.responsavel.trim()}`,
    tempo?.trim() && `tempo ${tempo.trim()}`,
    etapa.prazo.trim() && `prazo ${etapa.prazo.trim()}`,
    etapa.observacao.trim(),
  ].filter(Boolean);
  return `Etapa ${etapa.nome.trim()}: ${partes.join(" - ")}`;
}

export function substituirEtapasInstrucoes(instrucoes: string, etapas: EtapaOsLinha[]) {
  const linhas = (instrucoes || "").split("\n");
  const semEtapas = linhas.filter((line) => !/^Etapa\s+/i.test(line.trim()));
  const linhasEtapas = etapas
    .map((etapa) => formatarLinhaEtapa(etapa))
    .filter(Boolean);
  return [...semEtapas, ...linhasEtapas].join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Data/hora exibida na impressão da OS (ex.: 12/06/2024 18:00). */
export function formatarDataHoraEtapaImpressao(prazo?: string, dataEntrada?: string) {
  const limpo = (prazo || "").replace(/^prazo\s+/i, "").trim();
  if (limpo) return limpo;
  return (dataEntrada || "").trim();
}

export function resumoEtapasControle(etapas: EtapaOsLinha[]) {
  if (etapas.length === 0) return "";
  const nomes = [
    ...new Set(etapas.map((e) => nomeEtapaSemSetor(e.nome)).filter(Boolean)),
  ];
  return nomes.join(", ");
}

const SETORES_STORAGE_KEY = "labProteseSetores";

function corSetorCadastro(nomeSetor?: string) {
  if (!nomeSetor?.trim() || typeof window === "undefined") return undefined;
  try {
    const setores = readStorage<{ nome?: string; cor?: string }[]>(SETORES_STORAGE_KEY, []);
    return setores.find((s) => s.nome === nomeSetor)?.cor;
  } catch {
    return undefined;
  }
}

export type EtapaControleBadge = {
  nome: string;
  cor: string;
  texto: string;
};

/** Nomes únicos das etapas da OS com cor de fundo do cadastro de etapas. */
export function etapasUnicasComCor(
  etapas: EtapaOsLinha[],
  cadastro?: EtapaCadastro[]
): EtapaControleBadge[] {
  const modelos = cadastro ?? carregarEtapasCadastro();
  const vistas = new Set<string>();
  const resultado: EtapaControleBadge[] = [];

  for (const etapa of etapas) {
    const nome = nomeEtapaSemSetor(etapa.nome);
    if (!nome) continue;
    const chave = nome.toLowerCase();
    if (vistas.has(chave)) continue;
    vistas.add(chave);

    const modelo = modelos.find((m) => m.nome.trim().toLowerCase() === chave);
    const fundo = corFundoEtapa(
      modelo ?? { id: "", nome },
      modelo?.setor ? corSetorCadastro(modelo.setor) : undefined
    );
    resultado.push({
      nome,
      cor: fundo,
      texto: corTextoSobreFundo(fundo),
    });
  }

  return resultado;
}

export type TerceirizadoOsLinha = {
  nome: string;
  servico: string;
  custo: string;
};

const linhaEstruturadaOs = (line: string) => {
  const t = line.trim();
  return (
    /^Etapa\s+/i.test(t) ||
    /^Colaborador\s+/i.test(t) ||
    /^Terceirizado\s+/i.test(t) ||
    /^Arquivo anexado:/i.test(t) ||
    /^Arquivos anexados:/i.test(t) ||
    /^Material enviado:/i.test(t) ||
    /^Caixa:/i.test(t) ||
    /^Dentista(\s+convidado)?:/i.test(t) ||
    /^Caso odontológico:/i.test(t) ||
    /^Data laboratório:/i.test(t) ||
    /^Data dentista:/i.test(t) ||
    /^Item adicionado:/i.test(t)
  );
};

/** Texto livre das instruções (sem linhas geradas pela OS). */
export function instrucoesTextoLivre(instrucoes?: string | null) {
  return (instrucoes || "")
    .split("\n")
    .filter((line) => !linhaEstruturadaOs(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Remove etapas/colaboradores/terceirizados do corpo (ex.: segmento produto da OS dividida). */
export function removerComplementosOsDoCorpo(corpo: string) {
  return (corpo || "")
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      return (
        !/^Etapa\s+/i.test(t) &&
        !/^Colaborador\s+/i.test(t) &&
        !/^Terceirizado\s+/i.test(t)
      );
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function deduplicarEtapas(etapas: EtapaOsLinha[]) {
  const vistas = new Set<string>();
  return etapas.filter((etapa) => {
    const chave = etapa.nome.trim().toLowerCase();
    if (!chave || vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  });
}

export function parseTerceirizadosInstrucoes(instrucoes?: string | null): TerceirizadoOsLinha[] {
  return (instrucoes || "")
    .split("\n")
    .map((line) => {
      const match = line.trim().match(/^Terceirizado\s+(.+?):\s*(.*?)(?:\s*-\s*custo\s*(.*))?$/i);
      if (!match) return null;
      return {
        nome: match[1].trim(),
        servico: match[2]?.trim() || "",
        custo: match[3]?.trim() || "",
      };
    })
    .filter((item): item is TerceirizadoOsLinha => item !== null && Boolean(item.nome));
}

export function deduplicarColaboradores(colaboradores: ColaboradorOsLinha[]) {
  const vistas = new Set<string>();
  return colaboradores.filter((item) => {
    const chave = item.nome.trim().toLowerCase();
    if (!chave || vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  });
}

export function deduplicarTerceirizados(terceiros: TerceirizadoOsLinha[]) {
  const vistas = new Set<string>();
  return terceiros.filter((item) => {
    const chave = item.nome.trim().toLowerCase();
    if (!chave || vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  });
}

export function parseComplementosInstrucoesGrupo(textos: string[]) {
  const texto = textos.filter(Boolean).join("\n");
  return {
    etapas: deduplicarEtapas(parseEtapasInstrucoes(texto)),
    colaboradores: deduplicarColaboradores(parseColaboradoresInstrucoes(texto)),
    terceirizados: deduplicarTerceirizados(parseTerceirizadosInstrucoes(texto)),
    textoLivre: instrucoesTextoLivre(texto),
  };
}

export type ColaboradorOsLinha = {
  nome: string;
  comissao: string;
  etapa: string;
};

export function parseColaboradoresInstrucoes(instrucoes?: string | null): ColaboradorOsLinha[] {
  return (instrucoes || "")
    .split("\n")
    .map((line) => {
      const match = line
        .trim()
        .match(/^Colaborador\s+(.+?):\s*comiss[aã]o\s*([\d.,]+)\s*%?(?:\s*-\s*etapa\s*(.*))?$/i);
      if (!match) return null;
      const nome = match[1].trim();
      if (!nome || nome === "-") return null;
      return {
        nome,
        comissao: match[2]?.trim() || "0",
        etapa: match[3]?.trim() ? normalizarNomeEtapaCadastro(match[3].trim()) : "",
      };
    })
    .filter((item): item is ColaboradorOsLinha => item !== null && Boolean(item.nome));
}

export function comissaoPercentualSemSufixo(value: string) {
  return (value || "").replace(/%/g, "").trim();
}

/** Exibe comissão sempre com sufixo % (ex.: 10,00%). */
export function exibirComissaoPercentual(value: string) {
  const limpo = comissaoPercentualSemSufixo(value);
  if (!limpo) return "";
  const numero = Number(limpo.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(numero)) return "";
  return (
    numero.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + "%"
  );
}

/** Máscara de digitação para campo de comissão em %. */
export function formatarComissaoPercentInput(value: string) {
  const centavos = Number(String(value).replace(/\D/g, "")) || 0;
  const amount = centavos / 100;
  return (
    amount.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + "%"
  );
}

export function formatarLinhaColaborador(colaborador: ColaboradorOsLinha) {
  if (!colaborador.nome.trim()) return "";
  const comissao = comissaoPercentualSemSufixo(colaborador.comissao || "0");
  const etapaParte = colaborador.etapa.trim() ? ` - etapa ${colaborador.etapa.trim()}` : "";
  return `Colaborador ${colaborador.nome.trim()}: comissão ${comissao}%${etapaParte}`;
}

/** Colaboradores da aba OS + responsáveis das etapas (sem duplicar nomes). */
export function colaboradoresParaExibicaoControle(
  colaboradores: ColaboradorOsLinha[],
  etapas: EtapaOsLinha[]
) {
  const lista = deduplicarColaboradores(colaboradores);
  const nomes = new Set(lista.map((c) => c.nome.trim().toLowerCase()));

  for (const etapa of etapas) {
    const responsavel = etapa.responsavel.trim();
    if (!responsavel) continue;
    const chave = responsavel.toLowerCase();
    if (nomes.has(chave)) continue;
    nomes.add(chave);
    lista.push({ nome: responsavel, comissao: "", etapa: etapa.nome });
  }

  return lista;
}

export function resumoColaboradorControle(colaboradores: ColaboradorOsLinha[]) {
  if (colaboradores.length === 0) return "";
  const nomes = [...new Set(colaboradores.map((c) => c.nome.trim()).filter(Boolean))];
  return nomes.join(", ");
}
