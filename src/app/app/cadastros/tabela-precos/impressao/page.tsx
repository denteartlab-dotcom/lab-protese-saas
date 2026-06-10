"use client";

import { ArrowLeft, Printer } from "lucide-react";
import { Montserrat } from "next/font/google";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { PainelCarregando } from "@/components/ListaCarregando";
import { PainelConfigImpressaoTabelaPrecos } from "@/components/tabela-precos/PainelConfigImpressaoTabelaPrecos";
import { PreviewImpressaoTabelaPrecos } from "@/components/tabela-precos/PreviewImpressaoTabelaPrecos";
import { usePageReady } from "@/hooks/use-page-ready";
import { abrirPdfGerando } from "@/lib/pdf-viewer";
import { readStorage } from "@/lib/persisted-storage";
import {
  carregarConfigImpressaoTabelaPrecos,
  configPadraoImpressaoTabelaPrecos,
  salvarConfigImpressaoTabelaPrecos,
  type ConfigImpressaoTabelaPrecos,
} from "@/lib/tabela-precos-impressao-config";
import {
  gerarPdfTabelaPrecos,
  type CategoriaTabelaPrecoExport,
} from "@/lib/tabela-precos-lista-export";
import {
  TABELA_PRECOS_STORAGE_KEY,
  type CategoriaTabelaPrecoOs,
} from "@/lib/tabela-precos-os";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-montserrat",
});

type DadosTabelaStorage = {
  tabela?: string;
  categoriasPorTabela?: Record<string, CategoriaTabelaPrecoOs[]>;
};

function categoriasParaPreview(
  categorias: CategoriaTabelaPrecoOs[] | undefined
): CategoriaTabelaPrecoExport[] {
  return (categorias || []).map((categoria) => ({
    nome: categoria.nome,
    servicos: categoria.servicos.map((servico) => ({
      nome: servico.nome,
      valor: servico.valor,
      oculto: Boolean((servico as { oculto?: boolean }).oculto),
    })),
  }));
}

export default function ConfiguracaoImpressaoTabelaPrecosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nomeTabelaParam = searchParams.get("tabela")?.trim() || "";

  const [nomeTabela, setNomeTabela] = useState("");
  const [configGravada, setConfigGravada] = useState<ConfigImpressaoTabelaPrecos>(
    configPadraoImpressaoTabelaPrecos()
  );
  const [configPreview, setConfigPreview] = useState<ConfigImpressaoTabelaPrecos>(
    configPadraoImpressaoTabelaPrecos()
  );
  const [categorias, setCategorias] = useState<CategoriaTabelaPrecoExport[]>([]);
  const [buscaPreview, setBuscaPreview] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [imprimindo, setImprimindo] = useState(false);

  const paginaPronta = usePageReady(async () => {
    const dados = readStorage<DadosTabelaStorage | null>(TABELA_PRECOS_STORAGE_KEY, null);
    const tabelaAtiva =
      nomeTabelaParam ||
      dados?.tabela?.trim() ||
      Object.keys(dados?.categoriasPorTabela || {})[0] ||
      "Tabela Principal";

    setNomeTabela(tabelaAtiva);
    setCategorias(categoriasParaPreview(dados?.categoriasPorTabela?.[tabelaAtiva]));

    const salva = await carregarConfigImpressaoTabelaPrecos(tabelaAtiva);
    setConfigGravada(salva);
    setConfigPreview(salva);
  });

  const onAlteracaoConfig = useCallback((novo: ConfigImpressaoTabelaPrecos) => {
    setConfigPreview(novo);
  }, []);

  async function gravarAlteracoes(novo: ConfigImpressaoTabelaPrecos) {
    if (!nomeTabela) return;
    setSalvando(true);
    try {
      await salvarConfigImpressaoTabelaPrecos(nomeTabela, novo);
      setConfigGravada(novo);
      setConfigPreview(novo);
    } catch {
      alert("Não foi possível salvar as configurações.");
    } finally {
      setSalvando(false);
    }
  }

  async function imprimir() {
    if (!nomeTabela) return;
    setImprimindo(true);
    try {
      await abrirPdfGerando(
        () => gerarPdfTabelaPrecos(nomeTabela, categorias, configPreview),
        "tabela-precos.pdf",
        `Tabela de Preços — ${nomeTabela}`
      );
    } catch {
      alert("Não foi possível gerar a impressão.");
    } finally {
      setImprimindo(false);
    }
  }

  if (!paginaPronta) {
    return (
      <div className={montserrat.variable}>
        <PainelCarregando mensagem="Carregando configuração de impressão..." />
      </div>
    );
  }

  return (
    <div
      className={`${montserrat.variable} -mx-4 -mt-2 flex min-h-[calc(100vh-7rem)] flex-col font-sans`}
      style={{ fontFamily: "var(--font-montserrat), Arial, sans-serif" }}
    >
      <header className="flex shrink-0 items-center justify-end gap-2 bg-[#5c5c5c] px-4 py-2 text-white">
        <input
          type="search"
          value={buscaPreview}
          onChange={(evento) => setBuscaPreview(evento.target.value)}
          placeholder="Buscar no preview..."
          className="h-8 w-48 rounded border-0 bg-white px-2 text-xs text-slate-700 placeholder:text-slate-400"
        />
        <button
          type="button"
          onClick={() => router.push("/app/cadastros/tabela-precos")}
          className="flex items-center gap-1.5 rounded bg-slate-500 px-3 py-1.5 text-xs font-medium hover:bg-slate-600"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </button>
        <button
          type="button"
          disabled={imprimindo}
          onClick={() => void imprimir()}
          className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60"
        >
          <Printer className="h-3.5 w-3.5" />
          {imprimindo ? "Gerando..." : "Imprimir"}
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[250px] shrink-0 flex-col border-r border-slate-200 bg-white shadow-sm">
          <PainelConfigImpressaoTabelaPrecos
            key={nomeTabela}
            valoresIniciais={configGravada}
            onAlteracao={onAlteracaoConfig}
            onSalvar={gravarAlteracoes}
            salvando={salvando}
          />
        </aside>

        <main className="min-w-0 flex-1 bg-slate-100" aria-label="Área reservada" />

        <aside className="flex w-[min(50%,420px)] shrink-0 flex-col overflow-y-auto bg-slate-200/60 p-6">
          <PreviewImpressaoTabelaPrecos
            config={configPreview}
            categorias={categorias}
            nomeTabela={nomeTabela}
            filtro={buscaPreview}
          />
        </aside>
      </div>
    </div>
  );
}
