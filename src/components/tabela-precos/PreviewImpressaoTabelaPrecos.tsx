"use client";

import {
  alinhamentoCssImpressao,
  fonteCssImpressao,
  type ConfigImpressaoTabelaPrecos,
} from "@/lib/tabela-precos-impressao-config";
import type { CategoriaTabelaPrecoExport } from "@/lib/tabela-precos-lista-export";
import {
  cabecalhoRelatorioLaboratorio,
  carregarConfigLaboratorio,
  telefoneWhatsappLaboratorio,
} from "@/lib/configuracoes-lab";

type Props = {
  config: ConfigImpressaoTabelaPrecos;
  categorias: CategoriaTabelaPrecoExport[];
  nomeTabela: string;
};

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function cabecalhoLab(nomeTabela: string) {
  const cab = cabecalhoRelatorioLaboratorio();
  const cfg = carregarConfigLaboratorio();
  const telefone =
    telefoneWhatsappLaboratorio(cfg) ||
    cfg.telefoneComercial?.trim() ||
    cfg.celular?.trim() ||
    cab.telefones;
  return {
    nome: cab.nome || nomeTabela,
    telefone,
    email: cab.email,
  };
}

export function PreviewImpressaoTabelaPrecos({
  config,
  categorias,
  nomeTabela,
}: Props) {
  const cab = cabecalhoLab(nomeTabela);
  const alinhamento = alinhamentoCssImpressao(config.alinhamentoCategoria);
  const fontFamily = fonteCssImpressao(config.tipoFonte);
  const tamanhoServico = Math.max(8, config.tamanhoFonte - 2);
  const observacoes = [
    config.observacao1,
    config.observacao2,
    config.observacao3,
    config.observacao4,
  ].filter((texto) => texto.trim());

  const categoriasVisiveis = categorias
    .map((categoria) => ({
      ...categoria,
      servicos: categoria.servicos.filter((servico) => !servico.oculto),
    }))
    .filter((categoria) => categoria.servicos.length > 0);

  return (
    <div
      className="w-[210mm] shrink-0 min-h-[297mm] bg-white px-[15mm] py-[20mm] shadow-[0_4px_24px_rgba(0,0,0,0.12)]"
      style={{ fontFamily, fontSize: `${config.tamanhoFonte}px` }}
    >
      {config.mostrarCabecalho && (
        <header className="mb-4 text-center">
          <p className="font-bold" style={{ fontSize: `${config.tamanhoFonte}px` }}>
            {cab.nome}
          </p>
          {cab.telefone && (
            <p style={{ fontSize: `${tamanhoServico}px` }}>{cab.telefone}</p>
          )}
          {cab.email && (
            <p style={{ fontSize: `${tamanhoServico}px` }}>{cab.email}</p>
          )}
          <hr
            className="mt-3 border-0"
            style={{ borderTop: `1px solid ${config.corBordas}`, height: 1 }}
          />
        </header>
      )}

      {config.titulo.trim() && (
        <h1
          className="mb-4 font-normal uppercase"
          style={{
            textAlign: "center",
            color: config.corCategorias,
            fontSize: `${config.tamanhoFonte}px`,
          }}
        >
          {config.titulo}
        </h1>
      )}

      <div className="space-y-0">
        {categoriasVisiveis.map((categoria) => (
          <section key={categoria.nome} style={{ marginBottom: `${config.espacamentoCategorias}px` }}>
            <p
              className="font-normal uppercase"
              style={{
                textAlign: alinhamento,
                color: config.corCategorias,
                fontSize: `${config.tamanhoFonte}px`,
                marginBottom: `${Math.max(4, config.espacamentoCategorias / 2)}px`,
              }}
            >
              {categoria.nome}
            </p>
            <div>
              {categoria.servicos.map((servico) => (
                <div
                  key={`${categoria.nome}-${servico.nome}`}
                  className="flex items-center justify-between px-2"
                  style={{
                    border: `1px solid ${config.corBordas}`,
                    backgroundColor: "#f8f8f8",
                    color: config.corServicos,
                    fontSize: `${tamanhoServico}px`,
                    minHeight: `${config.espacamentoServicos}px`,
                    marginBottom: "2px",
                  }}
                >
                  <span className="flex-1 pr-2">{servico.nome}</span>
                  <span className="shrink-0 font-normal">R$ {money(servico.valor)}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {observacoes.length > 0 && (
        <footer className="mt-8 space-y-1" style={{ fontSize: `${tamanhoServico}px` }}>
          {observacoes.map((texto, indice) => (
            <p key={indice} style={{ color: config.corServicos }}>
              {texto}
            </p>
          ))}
        </footer>
      )}
    </div>
  );
}
