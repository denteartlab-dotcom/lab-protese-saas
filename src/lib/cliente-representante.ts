import type { ColaboradorListagem } from "@/lib/colaboradores-listagem";
import { configValueFromObservacoes } from "@/lib/cliente-financeiro";
import type { ColaboradorComissaoOsForm, ServicoTabelaPrecoOs } from "@/lib/tabela-precos-os";
import {
  colaboradoresIniciaisFormParaOsServico,
  comissaoColaboradorNaTabelaServico,
} from "@/lib/tabela-precos-os";

export type ClienteComRepresentante = {
  representanteColaboradorId?: string | null;
  observacoes?: string | null;
};

export function representanteTextoLegadoCliente(observacoes?: string | null) {
  return configValueFromObservacoes(observacoes, "Representante:");
}

export function resolverRepresentanteColaboradorId(
  cliente: ClienteComRepresentante,
  colaboradores: ColaboradorListagem[]
): string {
  const id = cliente.representanteColaboradorId?.trim();
  if (id) return id;

  const nomeLegado = representanteTextoLegadoCliente(cliente.observacoes);
  if (!nomeLegado) return "";

  const encontrado = colaboradores.find(
    (c) => c.nome.trim().toLowerCase() === nomeLegado.toLowerCase()
  );
  return encontrado?.id || "";
}

export function nomeRepresentanteColaboradorCliente(
  cliente: ClienteComRepresentante | undefined | null,
  colaboradores: ColaboradorListagem[]
): string {
  if (!cliente) return "";
  const id = resolverRepresentanteColaboradorId(cliente, colaboradores);
  if (!id) return "";
  return colaboradores.find((c) => c.id === id)?.nome.trim() || "";
}

export type EtapaComResponsavel = {
  responsavel: string;
};

function comissaoCadastroColaborador(cad: ColaboradorListagem, repeticao: boolean) {
  if (repeticao && cad.comissaoRepeticao?.replace(/[^\d]/g, "") !== "000") {
    return cad.comissaoRepeticao;
  }
  return cad.comissaoPercentual || "0,00";
}

export function aplicarRepresentanteEmEtapasOs<T extends EtapaComResponsavel>(
  etapas: T[],
  nomeRepresentante: string,
  sync?: (etapa: T) => T
): T[] {
  if (!nomeRepresentante.trim()) return etapas;
  return etapas.map((etapa) => {
    if (etapa.responsavel?.trim()) return etapa;
    const atualizada = { ...etapa, responsavel: nomeRepresentante };
    return sync ? sync(atualizada) : atualizada;
  });
}

export function aplicarRepresentanteEmColaboradoresOs(
  colaboradores: ColaboradorComissaoOsForm[],
  nomeRepresentante: string,
  servico: ServicoTabelaPrecoOs | undefined,
  repeticao: boolean,
  cadastro: ColaboradorListagem[]
): ColaboradorComissaoOsForm[] {
  if (!nomeRepresentante.trim()) return colaboradores;

  const cad = cadastro.find((c) => c.nome === nomeRepresentante);
  const linhaRepresentante: ColaboradorComissaoOsForm = {
    nome: nomeRepresentante,
    comissao:
      comissaoColaboradorNaTabelaServico(servico, nomeRepresentante, repeticao) ||
      (cad ? comissaoCadastroColaborador(cad, repeticao) : "0,00"),
    etapa: "",
  };

  if (colaboradores.length === 0) {
    if (servico) {
      const iniciais = colaboradoresIniciaisFormParaOsServico(servico, repeticao);
      if (iniciais.length === 0) return [linhaRepresentante];
      const idx = iniciais.findIndex(
        (c) => c.nome.trim().toLowerCase() === nomeRepresentante.toLowerCase()
      );
      if (idx >= 0) {
        return iniciais.map((c, i) =>
          i === idx
            ? { ...c, nome: nomeRepresentante, comissao: linhaRepresentante.comissao }
            : c
        );
      }
      return iniciais.map((c, i) => (i === 0 ? { ...c, ...linhaRepresentante } : c));
    }
    return [linhaRepresentante];
  }

  const idx = colaboradores.findIndex(
    (c) => c.nome.trim().toLowerCase() === nomeRepresentante.toLowerCase()
  );
  if (idx >= 0) {
    return colaboradores.map((c, i) =>
      i === idx
        ? { ...c, nome: nomeRepresentante, comissao: linhaRepresentante.comissao || c.comissao }
        : c
    );
  }

  const primeiroVazio = colaboradores.findIndex((c) => !c.nome.trim());
  if (primeiroVazio >= 0) {
    return colaboradores.map((c, i) =>
      i === primeiroVazio ? { ...c, ...linhaRepresentante } : c
    );
  }

  return colaboradores;
}
