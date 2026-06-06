"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PdfRelatorioProdutosViewer } from "@/components/PdfRelatorioProdutosViewer";
import { getProdutosEstoqueExtras } from "@/lib/estoque";
import { readStorage } from "@/lib/persisted-storage";
import {
  gerarRelatorioControleProdutos,
  type OpcaoEstoqueControle,
  type ProdutoRelatorioEstoque,
} from "@/lib/relatorio-estoque";

const PRODUTOS_REMOVIDOS_STORAGE_KEY = "labProteseProdutosRemovidosPermanentemente";
const PRODUTOS_EXCLUIDOS_STORAGE_KEY = "labProteseProdutosExcluidos";

type ProdutoApi = {
  id: string;
  nome: string;
  valor?: number;
  estoque?: number;
  marca?: string;
  etiqueta?: string;
  codigoBarras?: string;
  valorCusto?: number;
  estoqueMinimo?: number;
  estoqueMaximo?: number;
  unidadeMedida?: string;
};

const produtosPadrao: ProdutoApi[] = [
  { id: "padrao-brux", nome: "Brux", marca: "emc", estoque: 0, valorCusto: 10, valor: 30 },
  { id: "padrao-deline", nome: "Deline", marca: "labore", estoque: 0, valorCusto: 55, valor: 70 },
  { id: "padrao-estrutura", nome: "Estrutura PPR", estoque: 2, valorCusto: 150, valor: 180 },
  { id: "padrao-investa", nome: "Investa", estoque: 0, valorCusto: 46.8, valor: 63 },
  { id: "padrao-newflex", nome: "New-flex", marca: "journalab", estoque: 0, valorCusto: 17, valor: 30 },
  { id: "padrao-trilux", nome: "Trilux", estoque: 0, valorCusto: 36, valor: 60 },
];

function opcaoEstoqueValida(valor: string | null): OpcaoEstoqueControle {
  if (valor === "minimo" || valor === "maximo" || valor === "zero") return valor;
  return "todos";
}

function produtoParaRelatorio(produto: ProdutoApi, extras: Record<string, Partial<ProdutoApi>>): ProdutoRelatorioEstoque {
  const extra = extras[produto.id] || {};
  return {
    id: produto.id,
    nome: produto.nome,
    codigoBarras: (extra.codigoBarras ?? produto.codigoBarras) || "",
    etiqueta: (extra.etiqueta ?? produto.etiqueta) || "",
    marca: (extra.marca ?? produto.marca) || "",
    unidadeMedida: (extra.unidadeMedida ?? produto.unidadeMedida) || "un (Unitário)",
    estoque: extra.estoque ?? produto.estoque ?? 0,
    estoqueMinimo: extra.estoqueMinimo ?? produto.estoqueMinimo ?? 0,
    estoqueMaximo: extra.estoqueMaximo ?? produto.estoqueMaximo ?? 0,
    valorCusto: extra.valorCusto ?? produto.valorCusto ?? 0,
    valorVenda: produto.valor ?? 0,
  };
}

function filtrarBusca(produtos: ProdutoRelatorioEstoque[], termo: string) {
  const busca = termo.trim().toLowerCase();
  if (!busca) return produtos;
  return produtos.filter((produto) =>
    [produto.nome, produto.marca || "", produto.etiqueta || "", produto.codigoBarras || ""]
      .join(" ")
      .toLowerCase()
      .includes(busca)
  );
}

function ImprimirProdutosConteudo() {
  const searchParams = useSearchParams();
  const opcaoEstoque = opcaoEstoqueValida(searchParams.get("estoque"));
  const busca = String(searchParams.get("q") || "");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [produtos, setProdutos] = useState<ProdutoApi[]>([]);
  const [extras, setExtras] = useState<Record<string, Partial<ProdutoApi>>>({});

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      setCarregando(true);
      setErro("");
      try {
        const removidos = readStorage<string[]>(PRODUTOS_REMOVIDOS_STORAGE_KEY, []);
        const excluidos = readStorage<string[]>(PRODUTOS_EXCLUIDOS_STORAGE_KEY, []);
        const extrasLocal = getProdutosEstoqueExtras();

        let fromApi: ProdutoApi[] = [];
        try {
          const data = await fetch("/api/produtos").then((r) => r.json());
          if (Array.isArray(data)) fromApi = data as ProdutoApi[];
        } catch {
          /* mantém lista local */
        }

        const mapa = new Map<string, ProdutoApi>();
        for (const produto of produtosPadrao) {
          if (!removidos.includes(produto.id)) mapa.set(produto.id, produto);
        }
        for (const produto of fromApi) {
          if (!removidos.includes(produto.id)) mapa.set(produto.id, produto);
        }

        const ativos = Array.from(mapa.values()).filter((produto) => !excluidos.includes(produto.id));
        if (!ativo) return;
        setProdutos(ativos);
        setExtras(extrasLocal);
      } catch (err) {
        if (!ativo) return;
        setErro(err instanceof Error ? err.message : "Não foi possível carregar os produtos.");
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void carregar();
    return () => {
      ativo = false;
    };
  }, []);

  const relatorio = useMemo(() => {
    const mapa = new Map<string, ProdutoRelatorioEstoque>();
    for (const produto of produtos) {
      mapa.set(produto.id, produtoParaRelatorio(produto, extras));
    }
    const filtradosBusca = filtrarBusca(Array.from(mapa.values()), busca);
    const mapaFiltrado = new Map(filtradosBusca.map((produto) => [produto.id, produto]));
    return gerarRelatorioControleProdutos(mapaFiltrado, {
      opcaoEstoque,
      etiqueta: "Todas",
    });
  }, [produtos, extras, busca, opcaoEstoque]);

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#525659] text-sm text-slate-200">
        Carregando produtos...
      </div>
    );
  }

  if (erro) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-100 p-6 text-center">
        <p className="font-medium text-slate-800">{erro}</p>
        <Link href="/app/produtos" className="text-sm text-[#4a90d9] hover:underline">
          Voltar para produtos
        </Link>
      </div>
    );
  }

  return (
    <PdfRelatorioProdutosViewer
      linhas={relatorio.linhas}
      totalGeral={relatorio.totais.totalGeral}
    />
  );
}

export default function ImprimirProdutosPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#525659] text-sm text-slate-200">
          Carregando relatório...
        </div>
      }
    >
      <ImprimirProdutosConteudo />
    </Suspense>
  );
}
