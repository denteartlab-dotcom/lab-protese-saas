"use client";

import { ArrowLeft, ChevronDown, Printer } from "lucide-react";
import { Montserrat } from "next/font/google";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PainelCarregando } from "@/components/ListaCarregando";
import { useI18n } from "@/components/i18n-provider";
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
  extrairNomesTabelasPreco,
  TABELA_PRECOS_STORAGE_KEY,
  type CategoriaTabelaPrecoOs,
} from "@/lib/tabela-precos-os";
import { cn } from "@/lib/utils";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-montserrat",
});

type DadosTabelaStorage = {
  tabela?: string;
  tabelas?: string[];
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
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nomeTabelaParam = searchParams.get("tabela")?.trim() || "";
  const refBuscaTabela = useRef<HTMLDivElement>(null);

  const [nomeTabela, setNomeTabela] = useState("");
  const [tabelasCadastradas, setTabelasCadastradas] = useState<string[]>([]);
  const [configGravada, setConfigGravada] = useState<ConfigImpressaoTabelaPrecos>(
    configPadraoImpressaoTabelaPrecos()
  );
  const [configPreview, setConfigPreview] = useState<ConfigImpressaoTabelaPrecos>(
    configPadraoImpressaoTabelaPrecos()
  );
  const [categorias, setCategorias] = useState<CategoriaTabelaPrecoExport[]>([]);
  const [buscaTabela, setBuscaTabela] = useState("");
  const [dropdownTabelasAberto, setDropdownTabelasAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [imprimindo, setImprimindo] = useState(false);
  const [trocandoTabela, setTrocandoTabela] = useState(false);

  const paginaPronta = usePageReady(async () => {
    const dados = readStorage<DadosTabelaStorage | null>(TABELA_PRECOS_STORAGE_KEY, null);
    const nomes = extrairNomesTabelasPreco(dados);
    const tabelaAtiva =
      nomeTabelaParam ||
      dados?.tabela?.trim() ||
      nomes[0] ||
      t("cadastros.clientes.tabelaPrincipal");

    setTabelasCadastradas(nomes);
    setNomeTabela(tabelaAtiva);
    setCategorias(categoriasParaPreview(dados?.categoriasPorTabela?.[tabelaAtiva]));

    const salva = await carregarConfigImpressaoTabelaPrecos(tabelaAtiva);
    setConfigGravada(salva);
    setConfigPreview(salva);
  });

  const tabelasFiltradas = useMemo(() => {
    const termo = buscaTabela.trim().toLowerCase();
    if (!termo) return tabelasCadastradas;
    return tabelasCadastradas.filter((item) => item.toLowerCase().includes(termo));
  }, [tabelasCadastradas, buscaTabela]);

  useEffect(() => {
    if (!dropdownTabelasAberto) return;
    function fecharAoClicarFora(evento: MouseEvent) {
      if (!refBuscaTabela.current?.contains(evento.target as Node)) {
        setDropdownTabelasAberto(false);
        setBuscaTabela("");
      }
    }
    document.addEventListener("mousedown", fecharAoClicarFora);
    return () => document.removeEventListener("mousedown", fecharAoClicarFora);
  }, [dropdownTabelasAberto]);

  const onAlteracaoConfig = useCallback((novo: ConfigImpressaoTabelaPrecos) => {
    setConfigPreview(novo);
  }, []);

  async function trocarTabela(novaTabela: string) {
    if (!novaTabela || novaTabela === nomeTabela) {
      setDropdownTabelasAberto(false);
      setBuscaTabela("");
      return;
    }

    setTrocandoTabela(true);
    try {
      const dados = readStorage<DadosTabelaStorage | null>(TABELA_PRECOS_STORAGE_KEY, null);
      const salva = await carregarConfigImpressaoTabelaPrecos(novaTabela);
      setNomeTabela(novaTabela);
      setCategorias(categoriasParaPreview(dados?.categoriasPorTabela?.[novaTabela]));
      setConfigGravada(salva);
      setConfigPreview(salva);
      setBuscaTabela("");
      setDropdownTabelasAberto(false);
      router.replace(
        `/app/cadastros/tabela-precos/impressao?tabela=${encodeURIComponent(novaTabela)}`
      );
    } finally {
      setTrocandoTabela(false);
    }
  }

  async function gravarAlteracoes(novo: ConfigImpressaoTabelaPrecos) {
    if (!nomeTabela) return;
    setSalvando(true);
    try {
      await salvarConfigImpressaoTabelaPrecos(nomeTabela, novo);
      setConfigGravada(novo);
      setConfigPreview(novo);
    } catch {
      alert(t("cadastros.tabelaPrecos.impressao.erroSalvar"));
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
        t("cadastros.tabelaPrecos.impressao.arquivoPdf"),
        t("cadastros.tabelaPrecos.impressao.tituloPdf", { nome: nomeTabela })
      );
    } catch {
      alert(t("cadastros.tabelaPrecos.alerta.erroImprimir"));
    } finally {
      setImprimindo(false);
    }
  }

  if (!paginaPronta) {
    return (
      <div className={montserrat.variable}>
        <PainelCarregando mensagem={t("cadastros.tabelaPrecos.impressao.carregando")} />
      </div>
    );
  }

  return (
    <div
      className={`${montserrat.variable} -mx-4 -mt-2 flex min-h-[calc(100vh-7rem)] flex-col font-sans`}
      style={{ fontFamily: "var(--font-montserrat), Arial, sans-serif" }}
    >
      <header className="relative z-20 flex shrink-0 items-center justify-end gap-2 bg-[#5c5c5c] px-4 py-2 text-white">
        <div ref={refBuscaTabela} className="relative">
          <div className="flex items-center">
            <input
              type="search"
              value={dropdownTabelasAberto ? buscaTabela : nomeTabela}
              onChange={(evento) => {
                setBuscaTabela(evento.target.value);
                setDropdownTabelasAberto(true);
              }}
              onFocus={() => {
                setBuscaTabela("");
                setDropdownTabelasAberto(true);
              }}
              placeholder={t("cadastros.tabelaPrecos.impressao.buscarTabela")}
              disabled={trocandoTabela}
              className="h-8 w-56 rounded-l border-0 bg-white px-2 text-xs text-slate-700 placeholder:text-slate-400 disabled:opacity-60"
            />
            <button
              type="button"
              disabled={trocandoTabela}
              onClick={() => {
                setDropdownTabelasAberto((aberto) => !aberto);
                if (!dropdownTabelasAberto) setBuscaTabela("");
              }}
              className="flex h-8 items-center rounded-r border-l border-slate-200 bg-white px-2 text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              title={t("cadastros.tabelaPrecos.impressao.tabelasCadastradas")}
            >
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition", dropdownTabelasAberto && "rotate-180")}
              />
            </button>
          </div>

          {dropdownTabelasAberto && (
            <div className="absolute right-0 top-full z-50 mt-1 max-h-64 w-56 overflow-y-auto rounded border border-slate-300 bg-white text-xs text-slate-700 shadow-xl">
              {tabelasFiltradas.length === 0 ? (
                <p className="px-3 py-2 text-slate-500">
                  {t("cadastros.tabelaPrecos.impressao.nenhumaTabela")}
                </p>
              ) : (
                tabelasFiltradas.map((item) => {
                  const selecionada = item === nomeTabela;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => void trocarTabela(item)}
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50",
                        selecionada && "bg-blue-600 font-semibold text-white hover:bg-blue-600"
                      )}
                    >
                      <span className="truncate">{item}</span>
                      {selecionada && <span>✓</span>}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        <Link
          href="/app/cadastros/tabela-precos"
          className="flex items-center gap-1.5 rounded bg-slate-500 px-3 py-1.5 text-xs font-medium hover:bg-slate-600"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("cadastros.trabalhos.voltar")}
        </Link>
        <button
          type="button"
          disabled={imprimindo || trocandoTabela}
          onClick={() => void imprimir()}
          className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60"
        >
          <Printer className="h-3.5 w-3.5" />
          {imprimindo ? t("relatorio.gerando") : t("cadastros.comum.imprimir")}
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

        <main className="relative z-0 flex min-w-0 flex-1 overflow-y-auto bg-slate-100">
          <div className="mx-auto flex w-full max-w-[210mm] justify-center px-6 py-8">
            <PreviewImpressaoTabelaPrecos
              config={configPreview}
              categorias={categorias}
              nomeTabela={nomeTabela}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
