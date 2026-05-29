import { carregarEtapasCadastro } from "@/lib/etapas-os";
import { readStorage, writeStorage } from "@/lib/persisted-storage";

export const ITENS_CUSTO_CADASTRO_KEY = "labProteseItensCustoCadastro";
export const ITENS_CUSTO_CADASTRO_EVENT = "lab-itens-custo-cadastro-atualizado";

function nomesEtapasProducaoExcluir(): Set<string> {
  return new Set(
    carregarEtapasCadastro().map((etapa) => etapa.nome.trim().toLowerCase())
  );
}

function filtrarItensCusto(itens: string[]) {
  const etapas = nomesEtapasProducaoExcluir();
  return [...new Set(itens.map((n) => n.trim()).filter(Boolean))].filter(
    (nome) => !etapas.has(nome.toLowerCase())
  );
}

export function carregarItensCustoCadastro(): string[] {
  return filtrarItensCusto(readStorage<string[]>(ITENS_CUSTO_CADASTRO_KEY, []));
}

/** Remove etapas de produção que foram salvas por engano no cadastro de custos. */
export function higienizarItensCustoCadastro(): string[] {
  const limpos = carregarItensCustoCadastro();
  writeStorage(ITENS_CUSTO_CADASTRO_KEY, limpos);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ITENS_CUSTO_CADASTRO_EVENT));
  }
  return limpos;
}

export function salvarItemCustoCadastro(nome: string): string[] {
  const valor = nome.trim();
  if (!valor) return carregarItensCustoCadastro();
  const atuais = carregarItensCustoCadastro();
  if (atuais.some((item) => item.toLowerCase() === valor.toLowerCase())) {
    return atuais;
  }
  const proximo = filtrarItensCusto([...atuais, valor]);
  writeStorage(ITENS_CUSTO_CADASTRO_KEY, proximo);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ITENS_CUSTO_CADASTRO_EVENT));
  }
  return proximo;
}

export function removerItemCustoCadastro(nome: string): string[] {
  const valor = nome.trim();
  const proximo = carregarItensCustoCadastro().filter(
    (item) => item.toLowerCase() !== valor.toLowerCase()
  );
  writeStorage(ITENS_CUSTO_CADASTRO_KEY, proximo);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ITENS_CUSTO_CADASTRO_EVENT));
  }
  return proximo;
}
