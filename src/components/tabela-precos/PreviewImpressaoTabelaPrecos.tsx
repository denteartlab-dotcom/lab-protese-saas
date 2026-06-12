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
import { labImpressaoFromConfig } from "@/lib/lab-logo";

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
  const lab = labImpressaoFromConfig();
  const cab = cabecalhoRelatorioLaboratorio();
  const cfg = carregarConfigLaboratorio();
  const telefone =
    lab.telefones?.trim() ||
    telefoneWhatsappLaboratorio(cfg) ||
    cfg.telefoneComercial?.trim() ||
    cfg.celular?.trim() ||
    cab.telefones;
  return {
    nome: lab.marca?.trim() || cab.nome || nomeTabela,
    subtitulo: lab.marcaSubtitulo?.trim() || "",
    telefone,
    email: lab.email?.trim() || cab.email,
    logo: lab.logoDataUrl?.trim() || "",
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
  const tituloDoc = (config.titulo.trim() || nomeTabela).toUpperCase();
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
      className="w-[210mm] shrink-0 min-h-[297mm] bg-white px-[14mm] py-[16mm] shadow-[0_4px_24px_rgba(0,0,0,0.12)]"
      style={{ fontFamily, fontSize: `${config.tamanhoFonte}px` }}
    >
      {config.mostrarCabecalho && (
        <header className="mb-5 text-center">
          {cab.logo.startsWith("data:image") ? (
            <img
              src={cab.logo}
              alt=""
              className="mx-auto mb-2 max-h-[16mm] max-w-[22mm] object-contain"
            />
          ) : null}
          <p
            className="font-bold text-[#1e1e1e]"
            style={{ fontSize: `${config.tamanhoFonte}px` }}
          >
            {cab.nome}
          </p>
          {cab.subtitulo ? (
            <p className="text-[#5a5a5a]" style={{ fontSize: `${tamanhoServico}px` }}>
              {cab.subtitulo}
            </p>
          ) : null}
          {cab.telefone && (
            <p className="text-[#3c3c3c]" style={{ fontSize: `${tamanhoServico}px` }}>
              {cab.telefone}
            </p>
          )}
          {cab.email && (
            <p className="text-[#3c3c3c]" style={{ fontSize: `${tamanhoServico}px` }}>
              {cab.email}
            </p>
          )}
          <hr
            className="mx-auto mt-3 w-full border-0"
            style={{ borderTop: `1px solid ${config.corBordas}` }}
          />
        </header>
      )}

      <h1
        className="mb-4 font-bold uppercase tracking-wide"
        style={{
          textAlign: "center",
          color: config.corCategorias,
          fontSize: `${Math.max(11, config.tamanhoFonte * 0.85)}px`,
        }}
      >
        {tituloDoc}
      </h1>
      <hr
        className="mb-4 border-0"
        style={{ borderTop: `1px solid ${config.corBordas}` }}
      />

      <div
        className="space-y-0"
        style={{ gap: `${config.espacamentoCategorias}px` }}
      >
        {categoriasVisiveis.map((categoria) => (
          <section
            key={categoria.nome}
            className="mb-3 overflow-hidden"
            style={{
              border: `1px solid ${config.corBordas}`,
              marginBottom: `${config.espacamentoCategorias}px`,
            }}
          >
            <div
              className="border-b px-3 py-2 font-bold uppercase tracking-wide"
              style={{
                textAlign: alinhamento,
                color: config.corCategorias,
                fontSize: `${Math.max(9, config.tamanhoFonte * 0.75)}px`,
                backgroundColor: "#f8f8f8",
                borderColor: config.corBordas,
              }}
            >
              {categoria.nome}
            </div>
            <table className="w-full border-collapse">
              <tbody>
                {categoria.servicos.map((servico, indice) => (
                  <tr
                    key={`${categoria.nome}-${servico.nome}`}
                    style={{
                      borderTop: indice > 0 ? `1px solid ${config.corBordas}` : undefined,
                    }}
                  >
                    <td
                      className="px-3 py-1.5 align-middle"
                      style={{
                        color: config.corServicos,
                        fontSize: `${tamanhoServico}px`,
                        borderRight: `1px solid ${config.corBordas}`,
                        width: "72%",
                      }}
                    >
                      {servico.nome}
                    </td>
                    <td
                      className="whitespace-nowrap px-3 py-1.5 text-right align-middle font-medium tabular-nums"
                      style={{
                        color: config.corServicos,
                        fontSize: `${tamanhoServico}px`,
                        width: "28%",
                      }}
                    >
                      R$ {money(servico.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>

      {observacoes.length > 0 && (
        <footer className="mt-6 space-y-1" style={{ fontSize: `${tamanhoServico}px` }}>
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
