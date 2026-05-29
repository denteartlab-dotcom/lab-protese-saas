"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  FileSpreadsheet,
  Home,
  Printer,
} from "lucide-react";
import { CampoDataBr } from "@/components/campo-data-br";
import { PainelCarregando } from "@/components/ListaCarregando";
import { dateToBrShort } from "@/lib/datas-br";
import {
  getProdutosEstoqueExtras,
  listarTodosMovimentosEstoque,
  PRODUTOS_ESTOQUE_EVENT,
  type MovimentoEstoque,
} from "@/lib/estoque";
import {
  coletarColaboradoresMovimentos,
  coletarEtiquetasProdutos,
  coletarSetoresMovimentos,
  exportarRelatorioControleProdutosCsv,
  exportarRelatorioEstoqueCsv,
  exportarRelatorioPosicaoEstoqueCsv,
  exportarRelatorioVendaProdutosCsv,
  gerarRelatorioControleProdutos,
  gerarRelatorioMovimentacaoEstoque,
  gerarRelatorioPosicaoEstoque,
  gerarRelatorioVendaProdutos,
  moneyRelatorioEstoque,
  OPCOES_ESTOQUE_CONTROLE,
  OPCOES_RELATORIO_ESTOQUE,
  type FiltrosRelatorioEstoque,
  type LinhaControleProduto,
  type LinhaPosicaoEstoque,
  type LinhaRelatorioEstoque,
  type LinhaVendaProduto,
  type OpcaoEstoqueControle,
  type OpcaoRelatorioEstoque,
  type ProdutoRelatorioEstoque,
  type TotaisControleProduto,
  type TotaisPosicaoEstoque,
  type TotaisVendaProduto,
  type TrabalhoDataEntregaRelatorio,
} from "@/lib/relatorio-estoque";
import { readStorage } from "@/lib/persisted-storage";
import { abrirPdfGerando } from "@/lib/pdf-viewer";
import { gerarRelatorioEstoquePdf } from "@/lib/relatorio-estoque-pdf";
import { cn } from "@/lib/utils";

const labelClass = "mb-1 block text-[11px] font-normal text-[#6b7280]";
const selectClass =
  "h-[34px] w-full rounded-sm border border-[#d1d5db] bg-white px-2 text-[12px] text-[#374151] outline-none focus:border-[#4a90d9]";

const inputDataRelatorioClass =
  "h-[34px] w-full rounded-sm border border-[#d1d5db] bg-white text-[12px] text-[#374151] shadow-none focus:border-[#4a90d9] focus:ring-0";

const SETORES_STORAGE_KEY = "labProteseSetores";

const PRODUTOS_PADRAO: ProdutoRelatorioEstoque[] = [
  { id: "padrao-brux", nome: "Brux", etiqueta: "", marca: "emc" },
  { id: "padrao-deline", nome: "Deline", etiqueta: "", marca: "labore" },
  { id: "padrao-estrutura", nome: "Estrutura PPR", etiqueta: "", marca: "" },
  { id: "padrao-investa", nome: "Investa", etiqueta: "", marca: "" },
  { id: "padrao-newflex", nome: "New-flex", etiqueta: "", marca: "journalab" },
  { id: "padrao-trilux", nome: "Trilux", etiqueta: "", marca: "" },
];

function primeiroDiaMesBr() {
  const hoje = new Date();
  return dateToBrShort(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
}

const COLUNAS_MOVIMENTACAO = [
  "DATA",
  "TIPO",
  "PRODUTO",
  "ETIQUETA",
  "QUANTIDADE",
  "SETOR",
  "COLABORADOR",
] as const;

const COLUNAS_POSICAO = [
  "PRODUTO",
  "ETIQUETA",
  "MARCA",
  "ENTRADAS",
  "SAÍDAS",
  "ESTOQUE ATUAL",
  "VALOR UNITÁRIO",
  "VALOR",
] as const;

const COLUNAS_VENDA = [
  "DATA ENTREGUE",
  "QUANTIDADE",
  "PRODUTO",
  "MARCA",
  "VALOR CUSTO (ÚLTIMA COMPRA)",
  "VENDA",
  "LUCRO",
] as const;

const COLUNAS_CONTROLE = [
  "CODIGO",
  "PRODUTO",
  "ETIQUETA",
  "MARCA",
  "ESTOQUE ATUAL",
  "UNIDADE",
  "MÍNIMO",
  "MÁXIMO",
  "CUSTO",
  "VENDA",
  "TOTAL",
] as const;

const thClass =
  "px-3 py-3 text-center align-middle text-[11px] font-semibold uppercase tracking-wide";
const tdClass = "px-3 py-2.5 text-center align-middle text-[#374151]";

function CelulaEstoqueAtual({
  label,
  situacao,
}: {
  label: string;
  situacao: "Alto" | "Baixo" | null;
}) {
  return (
    <div className="flex justify-center">
      <div className="inline-grid grid-cols-[auto_auto] items-center gap-x-1.5">
        <span className="min-w-[4.25rem] text-right tabular-nums whitespace-nowrap">{label}</span>
        <span className="flex min-w-[2.85rem] items-center justify-start">
          {situacao === "Alto" && (
            <span className="inline-block shrink-0 rounded-full bg-[#fde8d8] px-2 py-0.5 text-[10px] font-bold leading-none text-[#e8956c]">
              Alto
            </span>
          )}
          {situacao === "Baixo" && (
            <span className="inline-block shrink-0 rounded-full bg-[#fee2e2] px-2 py-0.5 text-[10px] font-bold leading-none text-[#dc2626]">
              Baixo
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

function montarProdutoComExtras(
  base: ProdutoRelatorioEstoque,
  extras: Record<string, Record<string, unknown>>
): ProdutoRelatorioEstoque {
  const ex = extras[base.id] || {};
  return {
    ...base,
    etiqueta: String(ex.etiqueta ?? base.etiqueta ?? ""),
    marca: String(ex.marca ?? base.marca ?? ""),
    unidadeMedida: String(ex.unidadeMedida ?? base.unidadeMedida ?? "un (Unitário)"),
    estoque: Number(ex.estoque ?? base.estoque ?? 0),
    estoqueMinimo: Number(ex.estoqueMinimo ?? base.estoqueMinimo ?? 0),
    estoqueMaximo: Number(ex.estoqueMaximo ?? base.estoqueMaximo ?? 0),
    valorCusto: Number(ex.valorCusto ?? base.valorCusto ?? 0),
    codigoBarras: String(ex.codigoBarras ?? base.codigoBarras ?? ""),
    valorVenda: Number(ex.valor ?? base.valorVenda ?? 0),
  };
}

function TabelaPosicaoEstoque({
  linhas,
  totais,
}: {
  linhas: LinhaPosicaoEstoque[];
  totais: TotaisPosicaoEstoque;
}) {
  return (
    <div className="overflow-hidden rounded-sm border border-[#e5e7eb] bg-white shadow-sm print:border-0 print:shadow-none">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-[12px]">
          <colgroup>
            <col className="w-[16%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[16%]" />
          </colgroup>
          <thead>
            <tr className="bg-[#f3f4f6] text-[#6b7280]">
              {COLUNAS_POSICAO.map((col) => (
                <th key={col} className={thClass}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={COLUNAS_POSICAO.length} className="h-[280px] text-center text-[#9ca3af]">
                  Nenhum registro encontrado no período.
                </td>
              </tr>
            ) : (
              linhas.map((linha) => (
                <tr
                  key={linha.id}
                  className="border-b border-[#f3f4f6] transition-colors hover:bg-[#eef2ff] print:hover:bg-transparent"
                >
                  <td className={tdClass}>{linha.produto}</td>
                  <td className={tdClass}>
                    {linha.etiqueta ? (
                      <span className="inline-block rounded-sm bg-[#7c3aed] px-2 py-0.5 text-[10px] font-semibold text-white">
                        {linha.etiqueta}
                      </span>
                    ) : (
                      ""
                    )}
                  </td>
                  <td className={tdClass}>{linha.marca}</td>
                  <td className={cn(tdClass, "tabular-nums")}>{linha.entradas}</td>
                  <td className={cn(tdClass, "tabular-nums")}>{linha.saidas}</td>
                  <td className={tdClass}>
                    <CelulaEstoqueAtual label={linha.estoqueAtualLabel} situacao={linha.situacao} />
                  </td>
                  <td className={cn(tdClass, "tabular-nums")}>
                    {moneyRelatorioEstoque(linha.valorUnitario)}
                  </td>
                  <td className={cn(tdClass, "tabular-nums")}>
                    {moneyRelatorioEstoque(linha.valor)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {linhas.length > 0 && (
            <tfoot>
              <tr className="border-t border-[#e5e7eb] bg-white font-semibold text-[#374151]">
                <td className={tdClass} />
                <td className={tdClass} />
                <td className={cn(tdClass, "uppercase")}>Totais</td>
                <td className={cn(tdClass, "tabular-nums text-[#2563eb]")}>{totais.entradas}</td>
                <td className={cn(tdClass, "tabular-nums text-[#dc2626]")}>{totais.saidas}</td>
                <td className={tdClass} />
                <td className={tdClass} />
                <td className={cn(tdClass, "tabular-nums text-[#2563eb]")}>
                  {moneyRelatorioEstoque(totais.valor)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function TabelaControleProdutos({
  linhas,
  totais,
}: {
  linhas: LinhaControleProduto[];
  totais: TotaisControleProduto;
}) {
  return (
    <div className="overflow-hidden rounded-sm border border-[#e5e7eb] bg-white shadow-sm print:border-0 print:shadow-none">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-[12px]">
          <colgroup>
            <col className="w-[7%]" />
            <col className="w-[14%]" />
            <col className="w-[9%]" />
            <col className="w-[8%]" />
            <col className="w-[12%]" />
            <col className="w-[6%]" />
            <col className="w-[6%]" />
            <col className="w-[6%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
          </colgroup>
          <thead>
            <tr className="bg-[#f3f4f6] text-[#6b7280]">
              {COLUNAS_CONTROLE.map((col) => (
                <th key={col} className={thClass}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={COLUNAS_CONTROLE.length} className="h-[280px] text-center text-[#9ca3af]">
                  Nenhum produto encontrado.
                </td>
              </tr>
            ) : (
              linhas.map((linha) => (
                <tr
                  key={linha.id}
                  className="border-b border-[#f3f4f6] transition-colors hover:bg-[#eef2ff] print:hover:bg-transparent"
                >
                  <td className={tdClass}>{linha.codigo}</td>
                  <td className={cn(tdClass, "text-left")}>{linha.produto}</td>
                  <td className={tdClass}>
                    {linha.etiqueta ? (
                      <span className="inline-block rounded-full bg-[#7c3aed] px-2.5 py-0.5 text-[10px] font-semibold text-white">
                        {linha.etiqueta}
                      </span>
                    ) : (
                      ""
                    )}
                  </td>
                  <td className={tdClass}>{linha.marca}</td>
                  <td className={tdClass}>
                    <CelulaEstoqueAtual label={linha.estoqueAtualLabel} situacao={linha.situacao} />
                  </td>
                  <td className={tdClass}>{linha.unidade}</td>
                  <td className={cn(tdClass, "tabular-nums")}>{linha.minimoLabel}</td>
                  <td className={cn(tdClass, "tabular-nums")}>{linha.maximoLabel}</td>
                  <td className={cn(tdClass, "tabular-nums")}>{moneyRelatorioEstoque(linha.custo)}</td>
                  <td className={cn(tdClass, "tabular-nums")}>{moneyRelatorioEstoque(linha.venda)}</td>
                  <td className={cn(tdClass, "tabular-nums")}>{moneyRelatorioEstoque(linha.total)}</td>
                </tr>
              ))
            )}
          </tbody>
          {linhas.length > 0 && (
            <tfoot>
              <tr className="border-t border-[#e5e7eb] bg-white font-semibold text-[#374151]">
                <td className={tdClass} colSpan={8} />
                <td className={cn(tdClass, "tabular-nums")}>{moneyRelatorioEstoque(0)}</td>
                <td className={cn(tdClass, "tabular-nums")}>{moneyRelatorioEstoque(0)}</td>
                <td className={cn(tdClass, "tabular-nums")}>
                  {moneyRelatorioEstoque(totais.totalGeral)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function TabelaVendaProdutos({
  linhas,
  totais,
}: {
  linhas: LinhaVendaProduto[];
  totais: TotaisVendaProduto;
}) {
  return (
    <div className="overflow-hidden rounded-sm border border-[#e5e7eb] bg-white shadow-sm print:border-0 print:shadow-none">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-[12px]">
          <colgroup>
            <col className="w-[12%]" />
            <col className="w-[10%]" />
            <col className="w-[22%]" />
            <col className="w-[12%]" />
            <col className="w-[18%]" />
            <col className="w-[13%]" />
            <col className="w-[13%]" />
          </colgroup>
          <thead>
            <tr className="bg-[#f3f4f6] text-[#6b7280]">
              {COLUNAS_VENDA.map((col) => (
                <th
                  key={col}
                  className={cn(
                    thClass,
                    col === "VALOR CUSTO (ÚLTIMA COMPRA)" && "px-1 text-[10px] leading-tight"
                  )}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={COLUNAS_VENDA.length} className="h-[280px] text-center text-[#9ca3af]">
                  Nenhum registro encontrado no período.
                </td>
              </tr>
            ) : (
              linhas.map((linha) => (
                <tr
                  key={linha.id}
                  className="border-b border-[#f3f4f6] transition-colors hover:bg-[#eef2ff] print:hover:bg-transparent"
                >
                  <td className={cn(tdClass, "whitespace-nowrap")}>{linha.dataEntregue}</td>
                  <td className={cn(tdClass, "tabular-nums")}>{linha.quantidadeLabel}</td>
                  <td className={cn(tdClass, "text-left")}>{linha.produto}</td>
                  <td className={tdClass}>{linha.marca}</td>
                  <td className={cn(tdClass, "tabular-nums")}>
                    {moneyRelatorioEstoque(linha.valorCusto)}
                  </td>
                  <td className={cn(tdClass, "tabular-nums")}>
                    {moneyRelatorioEstoque(linha.venda)}
                  </td>
                  <td className={cn(tdClass, "tabular-nums")}>
                    {moneyRelatorioEstoque(linha.lucro)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-[#e5e7eb] bg-white font-semibold text-[#374151]">
              <td className={tdClass} />
              <td className={tdClass} />
              <td className={tdClass} />
              <td className={cn(tdClass, "uppercase")}>Total</td>
              <td className={cn(tdClass, "tabular-nums")}>
                {moneyRelatorioEstoque(totais.valorCusto)}
              </td>
              <td className={cn(tdClass, "tabular-nums")}>
                {moneyRelatorioEstoque(totais.venda)}
              </td>
              <td className={cn(tdClass, "tabular-nums")}>
                {moneyRelatorioEstoque(totais.lucro)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function TabelaMovimentacaoEstoque({ linhas }: { linhas: LinhaRelatorioEstoque[] }) {
  return (
    <div className="overflow-hidden rounded-sm border border-[#e5e7eb] bg-white shadow-sm print:border-0 print:shadow-none">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-[12px]">
          <colgroup>
            <col className="w-[18%]" />
            <col className="w-[10%]" />
            <col className="w-[22%]" />
            <col className="w-[14%]" />
            <col className="w-[10%]" />
            <col className="w-[13%]" />
            <col className="w-[13%]" />
          </colgroup>
          <thead>
            <tr className="bg-[#f3f4f6] text-[#6b7280]">
              {COLUNAS_MOVIMENTACAO.map((col) => (
                <th key={col} className={thClass}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={COLUNAS_MOVIMENTACAO.length} className="h-[280px] text-center text-[#9ca3af]">
                  Nenhum registro encontrado no período.
                </td>
              </tr>
            ) : (
              linhas.map((linha) => (
                <tr
                  key={linha.id}
                  className="border-b border-[#f3f4f6] transition-colors hover:bg-[#eef2ff] print:hover:bg-transparent"
                >
                  <td className={cn(tdClass, "whitespace-nowrap")}>{linha.dataLabel}</td>
                  <td className={tdClass}>{linha.tipo}</td>
                  <td className={tdClass}>{linha.produto}</td>
                  <td className={tdClass}>
                    {linha.etiqueta ? (
                      <span className="inline-block rounded-sm bg-[#7c3aed] px-2 py-0.5 text-[10px] font-semibold text-white">
                        {linha.etiqueta}
                      </span>
                    ) : (
                      ""
                    )}
                  </td>
                  <td className={cn(tdClass, "tabular-nums")}>{linha.quantidadeLabel}</td>
                  <td className={tdClass}>{linha.setor}</td>
                  <td className={tdClass}>{linha.colaborador}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RelatorioEstoqueConteudo() {
  const [carregando, setCarregando] = useState(true);
  const [movimentos, setMovimentos] = useState<MovimentoEstoque[]>([]);
  const [produtosPorId, setProdutosPorId] = useState<Map<string, ProdutoRelatorioEstoque>>(
    () => new Map()
  );
  const [setoresCadastro, setSetoresCadastro] = useState<string[]>([]);
  const [trabalhosPorId, setTrabalhosPorId] = useState<
    Map<string, TrabalhoDataEntregaRelatorio>
  >(() => new Map());

  const [opcaoRelatorio, setOpcaoRelatorio] = useState<OpcaoRelatorioEstoque>("movimentacao_agrupado");
  const [opcaoEstoque, setOpcaoEstoque] = useState<OpcaoEstoqueControle>("todos");
  const [colaborador, setColaborador] = useState("");
  const [etiqueta, setEtiqueta] = useState("Todas");
  const [tipoMovimento, setTipoMovimento] = useState("Todos");
  const [setor, setSetor] = useState("Todos");
  const [dataInicio, setDataInicio] = useState(primeiroDiaMesBr);
  const [dataFim, setDataFim] = useState(() => dateToBrShort(new Date()));

  const filtros = useMemo<FiltrosRelatorioEstoque>(
    () => ({
      colaborador,
      etiqueta,
      tipoMovimento,
      setor,
      dataInicio,
      dataFim,
    }),
    [colaborador, etiqueta, tipoMovimento, setor, dataInicio, dataFim]
  );

  const recarregar = useCallback(async () => {
    try {
      const extras = getProdutosEstoqueExtras();
      let fromApi: ProdutoRelatorioEstoque[] = [];
      try {
        const res = await fetch("/api/produtos", { cache: "no-store" });
        const data = res.ok ? await res.json() : [];
        if (Array.isArray(data)) {
          fromApi = data.map((p: { id: string; nome: string; valor?: number }) => ({
            id: p.id,
            nome: p.nome,
            valorVenda: Number(p.valor) || 0,
          }));
        }
      } catch {
        /* lista local */
      }

      const mapa = new Map<string, ProdutoRelatorioEstoque>();
      for (const p of PRODUTOS_PADRAO) {
        mapa.set(p.id, montarProdutoComExtras(p, extras));
      }
      for (const p of fromApi) {
        mapa.set(p.id, montarProdutoComExtras(p, extras));
      }

      setProdutosPorId(mapa);
      setMovimentos(listarTodosMovimentosEstoque());

      const mapaTrabalhos = new Map<string, TrabalhoDataEntregaRelatorio>();
      try {
        const resTrabalhos = await fetch("/api/trabalhos", { cache: "no-store" });
        const trabalhos = resTrabalhos.ok ? await resTrabalhos.json() : [];
        if (Array.isArray(trabalhos)) {
          for (const t of trabalhos as { id: string; dataEntrega?: string | null }[]) {
            if (t?.id) mapaTrabalhos.set(t.id, { dataEntrega: t.dataEntrega ?? null });
          }
        }
      } catch {
        /* sem vínculo de entrega */
      }
      setTrabalhosPorId(mapaTrabalhos);

      const setores = readStorage<{ nome?: string }[]>(SETORES_STORAGE_KEY, []);
      setSetoresCadastro(
        Array.isArray(setores)
          ? setores.map((s) => String(s?.nome || "").trim()).filter(Boolean)
          : []
      );
    } catch {
      setMovimentos([]);
      setProdutosPorId(new Map());
      setTrabalhosPorId(new Map());
      setSetoresCadastro([]);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setCarregando(true);
      await recarregar();
      setCarregando(false);
    })();
    const atualizar = () => void recarregar();
    window.addEventListener(PRODUTOS_ESTOQUE_EVENT, atualizar);
    window.addEventListener("focus", atualizar);
    return () => {
      window.removeEventListener(PRODUTOS_ESTOQUE_EVENT, atualizar);
      window.removeEventListener("focus", atualizar);
    };
  }, [recarregar]);

  const opcoesEtiqueta = useMemo(
    () => coletarEtiquetasProdutos([...produtosPorId.values()]),
    [produtosPorId]
  );

  const opcoesColaborador = useMemo(
    () => coletarColaboradoresMovimentos(movimentos),
    [movimentos]
  );

  const opcoesSetor = useMemo(
    () => coletarSetoresMovimentos(movimentos, setoresCadastro),
    [movimentos, setoresCadastro]
  );

  const linhasMovimentacao = useMemo(
    () => gerarRelatorioMovimentacaoEstoque(movimentos, produtosPorId, filtros),
    [movimentos, produtosPorId, filtros]
  );

  const posicao = useMemo(
    () => gerarRelatorioPosicaoEstoque(movimentos, produtosPorId, filtros),
    [movimentos, produtosPorId, filtros]
  );

  const controle = useMemo(
    () =>
      gerarRelatorioControleProdutos(produtosPorId, {
        opcaoEstoque,
        etiqueta,
      }),
    [produtosPorId, opcaoEstoque, etiqueta]
  );

  const venda = useMemo(
    () =>
      gerarRelatorioVendaProdutos(movimentos, produtosPorId, trabalhosPorId, {
        dataInicio,
        dataFim,
      }),
    [movimentos, produtosPorId, trabalhosPorId, dataInicio, dataFim]
  );

  const modoControle = opcaoRelatorio === "controle_produtos";
  const modoVenda = opcaoRelatorio === "venda_produtos";
  const modoAgrupado = opcaoRelatorio === "movimentacao_agrupado";

  function imprimir() {
    void abrirPdfGerando(async () => {
      if (modoControle) {
        return gerarRelatorioEstoquePdf("controle_produtos", dataInicio, dataFim, {
          tipo: "controle",
          linhas: controle.linhas,
          totais: controle.totais,
        });
      }
      if (modoVenda) {
        return gerarRelatorioEstoquePdf("venda_produtos", dataInicio, dataFim, {
          tipo: "venda",
          linhas: venda.linhas,
          totais: venda.totais,
        });
      }
      if (modoAgrupado) {
        return gerarRelatorioEstoquePdf("movimentacao_agrupado", dataInicio, dataFim, {
          tipo: "agrupado",
          linhas: posicao.linhas,
          totais: posicao.totais,
        });
      }
      return gerarRelatorioEstoquePdf("movimentacao", dataInicio, dataFim, {
        tipo: "movimentacao",
        linhas: linhasMovimentacao,
      });
    }, "relatorio-estoque.pdf");
  }

  function exportarExcel() {
    if (modoControle) {
      exportarRelatorioControleProdutosCsv(controle.linhas, controle.totais);
    } else if (modoVenda) {
      exportarRelatorioVendaProdutosCsv(venda.linhas, venda.totais);
    } else if (modoAgrupado) {
      exportarRelatorioPosicaoEstoqueCsv(posicao.linhas, posicao.totais);
    } else {
      exportarRelatorioEstoqueCsv(linhasMovimentacao);
    }
  }

  if (carregando) {
    return (
      <div className="min-h-[320px] bg-[#f3f4f6] pb-8 pt-1">
        <PainelCarregando mensagem="Carregando relatório de estoque..." />
      </div>
    );
  }

  return (
    <div className="relatorio-estoque bg-[#f3f4f6] pb-8 pt-1 text-[12px] text-[#374151] print:bg-white">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-[22px] font-normal leading-none text-[#6b7280]">Relatórios</h1>
        <div className="flex items-center gap-1.5 text-[12px] text-[#9ca3af]">
          <Home className="h-3.5 w-3.5 shrink-0" />
          <span className="text-[#d1d5db]">/</span>
          <span className="text-[#6b7280]">Estoque</span>
        </div>
      </div>

      <div id="relatorio-estoque-impressao" className="space-y-4 print:space-y-3">
        <div className="overflow-visible rounded-sm border border-[#e5e7eb] bg-white shadow-sm print:hidden">
          <div className="space-y-3 px-4 py-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1">
                <label className={labelClass}>Opções de Relatório</label>
                <div className="relative">
                  <select
                    className={cn(selectClass, "appearance-none pr-8")}
                    value={opcaoRelatorio}
                    onChange={(e) => setOpcaoRelatorio(e.target.value as OpcaoRelatorioEstoque)}
                  >
                    {OPCOES_RELATORIO_ESTOQUE.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
                </div>
              </div>

              {modoControle && (
                <>
                  <div className="w-[160px]">
                    <label className={labelClass}>Opções de Estoque</label>
                    <div className="relative">
                      <select
                        className={cn(selectClass, "appearance-none pr-8")}
                        value={opcaoEstoque}
                        onChange={(e) => setOpcaoEstoque(e.target.value as OpcaoEstoqueControle)}
                      >
                        {OPCOES_ESTOQUE_CONTROLE.map((op) => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
                    </div>
                  </div>
                  <div className="w-[140px]">
                    <label className={labelClass}>Etiqueta</label>
                    <div className="relative">
                      <select
                        className={cn(selectClass, "appearance-none pr-8")}
                        value={etiqueta}
                        onChange={(e) => setEtiqueta(e.target.value)}
                      >
                        {opcoesEtiqueta.map((op) => (
                          <option key={op} value={op}>
                            {op}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
                    </div>
                  </div>
                </>
              )}

              <div className="flex shrink-0 items-end gap-2 pb-0.5">
                <button
                  type="button"
                  onClick={imprimir}
                  className="inline-flex h-[34px] items-center gap-2 rounded-sm bg-[#4a90d9] px-4 text-[12px] font-semibold text-white hover:bg-[#3d7fc4]"
                >
                  <Printer className="h-4 w-4" />
                  Imprimir
                </button>
                <button
                  type="button"
                  onClick={exportarExcel}
                  className="flex h-[34px] w-[34px] items-center justify-center rounded-sm bg-[#5cb85c] text-white hover:bg-[#4cae4c]"
                  title="Exportar Excel"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                </button>
              </div>
            </div>

            {modoVenda && (
              <div className="max-w-md">
                <label className={labelClass}>Período</label>
                <div className="flex items-center gap-2">
                  <CampoDataBr
                    value={dataInicio}
                    onChange={setDataInicio}
                    iconPosition="left"
                    className="min-w-0 flex-1 space-y-0"
                    inputClassName={inputDataRelatorioClass}
                  />
                  <CampoDataBr
                    value={dataFim}
                    onChange={setDataFim}
                    iconPosition="left"
                    className="min-w-0 flex-1 space-y-0"
                    inputClassName={inputDataRelatorioClass}
                  />
                </div>
              </div>
            )}

            {!modoControle && !modoVenda && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label className={labelClass}>Colaboradores</label>
                <select
                  className={selectClass}
                  value={colaborador}
                  onChange={(e) => setColaborador(e.target.value)}
                >
                  {opcoesColaborador.map((nome) => (
                    <option key={nome || "todos"} value={nome}>
                      {nome ? nome : "\u00a0"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Etiqueta</label>
                <select
                  className={selectClass}
                  value={etiqueta}
                  onChange={(e) => setEtiqueta(e.target.value)}
                >
                  {opcoesEtiqueta.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Tipo Movimento</label>
                <select
                  className={selectClass}
                  value={tipoMovimento}
                  onChange={(e) => setTipoMovimento(e.target.value)}
                >
                  <option value="Todos">Todos</option>
                  <option value="Entrada">Entrada</option>
                  <option value="Saída">Saída</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Setor</label>
                <select className={selectClass} value={setor} onChange={(e) => setSetor(e.target.value)}>
                  {opcoesSetor.map((op) => (
                    <option key={op} value={op}>
                      {op === "Todos" ? "Todos" : op}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Período</label>
                <div className="flex items-center gap-2">
                  <CampoDataBr
                    value={dataInicio}
                    onChange={setDataInicio}
                    iconPosition="left"
                    className="min-w-0 flex-1 space-y-0"
                    inputClassName={inputDataRelatorioClass}
                  />
                  <CampoDataBr
                    value={dataFim}
                    onChange={setDataFim}
                    iconPosition="left"
                    className="min-w-0 flex-1 space-y-0"
                    inputClassName={inputDataRelatorioClass}
                  />
                </div>
              </div>
            </div>
            )}
          </div>
        </div>

        {modoControle ? (
          <TabelaControleProdutos linhas={controle.linhas} totais={controle.totais} />
        ) : modoVenda ? (
          <TabelaVendaProdutos linhas={venda.linhas} totais={venda.totais} />
        ) : modoAgrupado ? (
          <TabelaPosicaoEstoque linhas={posicao.linhas} totais={posicao.totais} />
        ) : (
          <TabelaMovimentacaoEstoque linhas={linhasMovimentacao} />
        )}
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #relatorio-estoque-impressao,
          #relatorio-estoque-impressao * {
            visibility: visible;
          }
          #relatorio-estoque-impressao {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
