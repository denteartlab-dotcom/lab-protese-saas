import { readStorage } from "@/lib/persisted-storage";

export const ETAPAS_STORAGE_KEY = "labProteseEtapas";

export type EtapaCadastro = {
  id: string;
  nome: string;
  setor?: string;
  tempoMedio?: string;
  calculoPorElemento?: string;
};

export type EtapaOsLinha = {
  /** Índice estável na lista de etapas da OS */
  indice: number;
  nome: string;
  responsavel: string;
  prazo: string;
  observacao: string;
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

function parseRestoEtapa(resto: string) {
  let responsavel = "";
  let prazo = "";
  const observacoes: string[] = [];

  for (const parte of resto.split(" - ").map((p) => p.trim()).filter(Boolean)) {
    if (/^resp\./i.test(parte)) {
      responsavel = parte.replace(/^resp\.\s*/i, "").trim();
    } else if (/^tempo\s+/i.test(parte)) {
      continue;
    } else if (/^prazo\s+/i.test(parte)) {
      prazo = parte.replace(/^prazo\s*/i, "").trim();
    } else {
      observacoes.push(parte);
    }
  }

  return {
    responsavel,
    prazo,
    observacao: observacoes.join(" - "),
  };
}

export function parseEtapasInstrucoes(instrucoes?: string | null): EtapaOsLinha[] {
  const linhas = (instrucoes || "").split("\n");
  const etapas: EtapaOsLinha[] = [];

  linhas.forEach((line) => {
    const match = line.trim().match(/^Etapa\s+(.+?):\s*(.*)$/i);
    if (!match) return;
    const nome = match[1].trim();
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

export function resumoEtapasControle(etapas: EtapaOsLinha[]) {
  if (etapas.length === 0) return "";
  const nomes = [...new Set(etapas.map((e) => e.nome.trim()).filter(Boolean))];
  return nomes.join(", ");
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
        etapa: match[3]?.trim() || "",
      };
    })
    .filter((item): item is ColaboradorOsLinha => item !== null && Boolean(item.nome));
}

export function formatarLinhaColaborador(colaborador: ColaboradorOsLinha) {
  if (!colaborador.nome.trim()) return "";
  const comissao = (colaborador.comissao || "0").replace(/%/g, "").trim();
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
