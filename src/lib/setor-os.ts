import { parseEtapasInstrucoes, type EtapaCadastro, nomeEtapaSemSetor } from "@/lib/etapas-os";
import { valorLinhaInstrucao } from "@/lib/modulo-producao-os";

export function linhaSetorOs(setor: string) {
  const nome = setor.trim();
  return nome ? `Setor: ${nome}` : "";
}

export function parseSetorOsInstrucoes(instrucoes?: string | null): string {
  return valorLinhaInstrucao(instrucoes || "", "Setor:");
}

export function setorResponsavelDasEtapas(
  etapas: Array<{ nome?: string; setor?: string }>,
  etapasCadastro: EtapaCadastro[] = []
): string {
  for (const etapa of etapas) {
    const direto = (etapa.setor || "").trim();
    if (direto) return direto;
    const nome = (etapa.nome || "").trim();
    if (!nome) continue;
    const chave = nomeEtapaSemSetor(nome).toLowerCase();
    const modelo = etapasCadastro.find(
      (item) =>
        item.nome.trim() === nome ||
        nomeEtapaSemSetor(item.nome).toLowerCase() === chave
    );
    if (modelo?.setor?.trim()) return modelo.setor.trim();
  }
  return "";
}

/** Setor responsável gravado na OS, ou o da primeira etapa do serviço. */
export function setorResponsavelOs(
  instrucoes?: string | null,
  etapasCadastro: EtapaCadastro[] = []
): string {
  const gravado = parseSetorOsInstrucoes(instrucoes);
  if (gravado) return gravado;
  return setorResponsavelDasEtapas(parseEtapasInstrucoes(instrucoes), etapasCadastro);
}
