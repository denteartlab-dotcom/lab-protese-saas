"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PdfRelatorioProdutosViewer } from "@/components/PdfRelatorioProdutosViewer";
import { useI18n } from "@/components/i18n-provider";
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

function ImprimirProdutosCarregando() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#525659] text-sm text-slate-200">
      {t("print.produtos.carregando")}
    </div>
  );
}

function ImprimirProdutosConteudo() {
  const { t } = useI18n();
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

        const ativos = fromApi.filter(
          (produto) => produto?.id && !removidos.includes(produto.id) && !excluidos.includes(produto.id)
        );
        if (!ativo) return;
        setProdutos(ativos);
        setExtras(extrasLocal);
      } catch (err) {
        if (!ativo) return;
        setErro(err instanceof Error ? err.message : t("print.produtos.erroCarregar"));
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void carregar();
    return () => {
      ativo = false;
    };
  }, [t]);

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
    return <ImprimirProdutosCarregando />;
  }

  if (erro) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-100 p-6 text-center">
        <p className="font-medium text-slate-800">{erro}</p>
        <Link href="/app/produtos" className="text-sm text-[#4a90d9] hover:underline">
          {t("print.produtos.voltar")}
        </Link>
      </div>
    );
  }

  return (
    <PdfRelatorioProdutosViewer
      titulo={t("print.produtos.tituloRelatorio")}
      linhas={relatorio.linhas}
      totalGeral={relatorio.totais.totalGeral}
    />
  );
}

export default function ImprimirProdutosPage() {
  return (
    <Suspense fallback={<ImprimirProdutosCarregando />}>
      <ImprimirProdutosConteudo />
    </Suspense>
  );
}
