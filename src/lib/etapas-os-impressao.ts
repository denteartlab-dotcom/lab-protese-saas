/**
 * Funções puras de etapas/colaboradores usadas na impressão da OS.
 * Módulo isolado — sem readStorage nem urgencia-cliente (evita TDZ no bundle).
 */

export type EtapaOsLinha = {
  indice: number;
  nome: string;
  responsavel: string;
  prazo: string;
  observacao: string;
  tempo?: string;
};

export type EtapasPorServicoOs = {
  titulo: string;
  etapas: EtapaOsLinha[];
};

export type ColaboradorOsLinha = {
  nome: string;
  comissao: string;
  etapa: string;
};

function isLinhaAuditoriaUrgenciaCliente(linha: string) {
  return linha.includes("Urgência solicitada pelo cliente");
}

export function nomeEtapaSemSetor(nome: string) {
  const texto = nome.trim();
  const separador = texto.indexOf(" — ");
  return separador >= 0 ? texto.slice(0, separador).trim() : texto;
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

export function parseEtapasInstrucoes(instrucoes?: string | null): EtapaOsLinha[] {
  const linhas = (instrucoes || "").split("\n");
  const etapas: EtapaOsLinha[] = [];

  linhas.forEach((line) => {
    const match = line.trim().match(/^Etapa\s+(.+?):\s*(.*)$/i);
    if (!match) return;
    const nome = nomeEtapaSemSetor(match[1].trim());
    const resto = parseRestoEtapa(match[2] || "");
    etapas.push({
      indice: etapas.length,
      nome,
      ...resto,
    });
  });

  return etapas;
}

export function formatarDataHoraEtapaImpressao(prazo?: string, dataEntrada?: string) {
  const limpo = (prazo || "").replace(/^prazo\s+/i, "").trim();
  if (limpo) return limpo;
  return (dataEntrada || "").trim();
}

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

export function instrucoesTextoLivre(instrucoes?: string | null) {
  return (instrucoes || "")
    .split("\n")
    .filter((line) => !linhaEstruturadaOs(line))
    .filter((line) => !isLinhaAuditoriaUrgenciaCliente(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function deduplicarColaboradores(colaboradores: ColaboradorOsLinha[]) {
  const vistas = new Set<string>();
  return colaboradores.filter((item) => {
    const chave = item.nome.trim().toLowerCase();
    if (!chave || vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  });
}

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
        etapa: match[3]?.trim() ? nomeEtapaSemSetor(match[3].trim()) : "",
      };
    })
    .filter((item): item is ColaboradorOsLinha => item !== null && Boolean(item.nome));
}

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

export function colaboradorMetadadosImpressao(opts: {
  explicito?: string | null;
  colaboradores?: ColaboradorOsLinha[];
  etapas?: EtapaOsLinha[];
}): string {
  const linha = (opts.explicito || "").trim();
  if (linha) return linha;
  return resumoColaboradorControle(
    colaboradoresParaExibicaoControle(opts.colaboradores || [], opts.etapas || [])
  );
}

export function colaboradorExibirNoTopoImpressao(
  exibirColaborador: boolean,
  exibirEtapas: boolean,
  etapasLista: EtapaOsLinha[]
): boolean {
  return exibirColaborador && !(exibirEtapas && etapasLista.length > 0);
}

export function colaboradorParaImpressao(instrucoes?: string | null) {
  const linhas = (instrucoes || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const explicito =
    linhas.find((line) => line.startsWith("Colaborador:"))?.replace(/^Colaborador:\s*/i, "").trim() ||
    "";
  return colaboradorMetadadosImpressao({
    explicito,
    colaboradores: parseColaboradoresInstrucoes(instrucoes),
    etapas: parseEtapasInstrucoes(instrucoes),
  });
}

export function colaboradorDaEtapaImpressao(
  etapa: EtapaOsLinha,
  colaboradores: ColaboradorOsLinha[] = []
): string {
  const responsavel = etapa.responsavel.trim();
  if (responsavel) return responsavel;

  const chaveEtapa = nomeEtapaSemSetor(etapa.nome).toLowerCase();
  if (!chaveEtapa) return "";

  const vinculado = colaboradores.find((colab) => {
    const etapaColab = nomeEtapaSemSetor(colab.etapa).toLowerCase();
    return etapaColab && etapaColab === chaveEtapa;
  });
  return vinculado?.nome.trim() || "";
}

export function etapasPorServicoImpressao(
  trabalhos: Array<{
    tipoProtese?: string | null;
    instrucoes?: string | null;
    segmentoFaturamento?: string | null;
  }>,
  segmentoEfetivo: (trabalho: {
    segmentoFaturamento?: string | null;
    instrucoes?: string | null;
  }) => "servico" | "produto" | "transporte"
): EtapasPorServicoOs[] {
  return trabalhos
    .filter((row) => segmentoEfetivo(row) === "servico")
    .map((row) => ({
      titulo: (row.tipoProtese || "").trim() || "Serviço",
      etapas: parseEtapasInstrucoes(row.instrucoes),
    }))
    .filter((bloco) => bloco.etapas.length > 0);
}
