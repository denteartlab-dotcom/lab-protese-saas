"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, MessageCircle, Printer, X } from "lucide-react";
import { Select } from "@/components/ui";
import {
  carregarConfigLaboratorio,
  telefoneWhatsappLaboratorio,
} from "@/lib/configuracoes-lab";
import {
  CONFIG_FATURAS_ATUALIZADA_EVENT,
  carregarConfiguracoesFaturas,
  formatoPorModeloFatura,
  modeloPadraoParaFormatoFatura,
  modelosFaturaPorFormato,
  nomeModeloFatura,
  sincronizarConfiguracoesFaturasDoServidor,
  type ConfiguracoesFaturas,
  type ModeloFaturaId,
} from "@/lib/configuracoes-faturas";
import { cn } from "@/lib/utils";

export type FormatoImpressaoFatura = "a4" | "termica";

export type OpcoesImpressaoFaturaModal = {
  formato: FormatoImpressaoFatura;
  modelo: ModeloFaturaId;
  duasVias: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  numeroFatura: number;
  clienteNome: string;
  valorFatura?: number;
  gerarHtml: (opcoes: OpcoesImpressaoFaturaModal) => string;
};

function aplicarFormatoNoHtml(html: string, formato: FormatoImpressaoFatura, duasVias: boolean) {
  let resultado = html;
  if (formato === "termica") {
    resultado = resultado
      .replace(/@page\{size:A4;margin:0\}/g, "@page{size:80mm auto;margin:0}")
      .replace(/width:210mm/g, "width:80mm")
      .replace(/min-height:297mm/g, "min-height:auto");
  }
  if (!duasVias) return resultado;
  const pagina = resultado.match(/<div class="page">[\s\S]*?<\/div>\s*(?=<\/body>)/);
  if (!pagina) return resultado;
  return resultado.replace(
    "</body>",
    `<div style="page-break-before:always"></div>${pagina[0]}</body>`
  );
}

function abrirHtmlFatura(html: string, imprimir: boolean) {
  const janela = window.open("", "_blank", "noopener,noreferrer");
  if (!janela) {
    alert("Permita pop-ups para visualizar ou imprimir a fatura.");
    return;
  }
  janela.document.write(html);
  janela.document.close();
  janela.focus();
  if (imprimir) {
    const disparar = () => {
      try {
        janela.print();
      } catch {
        /* ignore */
      }
    };
    if (janela.document.readyState === "complete") disparar();
    else janela.onload = disparar;
  }
}

export function ImprimirFaturaModal({
  open,
  onClose,
  numeroFatura,
  clienteNome,
  valorFatura,
  gerarHtml,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [config, setConfig] = useState<ConfiguracoesFaturas>(() =>
    carregarConfiguracoesFaturas()
  );
  const [sincronizando, setSincronizando] = useState(false);
  const [formato, setFormato] = useState<FormatoImpressaoFatura>("a4");
  const [modelo, setModelo] = useState<ModeloFaturaId>("modelo1");
  const [duasVias, setDuasVias] = useState("nao");

  const recarregarConfig = useCallback(async () => {
    setSincronizando(true);
    try {
      const cfg = await sincronizarConfiguracoesFaturasDoServidor();
      setConfig(cfg);
      return cfg;
    } catch {
      const cfg = carregarConfiguracoesFaturas();
      setConfig(cfg);
      return cfg;
    } finally {
      setSincronizando(false);
    }
  }, []);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    let ativo = true;
    void recarregarConfig().then((cfg) => {
      if (!ativo) return;
      const fmt = formatoPorModeloFatura(cfg.modeloPadrao);
      const mod = modeloPadraoParaFormatoFatura(cfg, fmt);
      setFormato(fmt);
      setModelo(mod);
      setDuasVias(cfg.duasVias[mod] ? "sim" : "nao");
    });
    return () => {
      ativo = false;
    };
  }, [open, recarregarConfig]);

  useEffect(() => {
    if (!open) return;
    const handler = () => {
      void recarregarConfig().then((cfg) => {
        const fmt = formatoPorModeloFatura(cfg.modeloPadrao);
        const mod = modeloPadraoParaFormatoFatura(cfg, fmt);
        setFormato(fmt);
        setModelo(mod);
        setDuasVias(cfg.duasVias[mod] ? "sim" : "nao");
      });
    };
    window.addEventListener(CONFIG_FATURAS_ATUALIZADA_EVENT, handler);
    return () => window.removeEventListener(CONFIG_FATURAS_ATUALIZADA_EVENT, handler);
  }, [open, recarregarConfig]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const modelosDoFormato = useMemo(() => modelosFaturaPorFormato(formato), [formato]);

  function opcoesAtuais(): OpcoesImpressaoFaturaModal {
    return {
      formato,
      modelo,
      duasVias: duasVias === "sim",
    };
  }

  function htmlPreparado() {
    const html = gerarHtml(opcoesAtuais());
    return aplicarFormatoNoHtml(html, formato, duasVias === "sim");
  }

  function aoMudarFormato(novo: FormatoImpressaoFatura) {
    setFormato(novo);
    const proximo = modeloPadraoParaFormatoFatura(config, novo);
    setModelo(proximo);
    setDuasVias(config.duasVias[proximo] ? "sim" : "nao");
  }

  function aoMudarModelo(novo: string) {
    const id = novo as ModeloFaturaId;
    setModelo(id);
    setDuasVias(config.duasVias[id] ? "sim" : "nao");
    const fmtModelo = formatoPorModeloFatura(id);
    if (fmtModelo !== formato) setFormato(fmtModelo);
  }

  function imprimir() {
    abrirHtmlFatura(htmlPreparado(), true);
  }

  function visualizarPdf() {
    abrirHtmlFatura(htmlPreparado(), false);
  }

  function enviarWhatsapp() {
    const cfg = carregarConfigLaboratorio();
    const digits = (telefoneWhatsappLaboratorio(cfg) || cfg.whatsapp || "").replace(/\D/g, "");
    const valor =
      valorFatura != null
        ? valorFatura.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "";
    const texto = encodeURIComponent(
      [
        `Fatura ${numeroFatura} — ${clienteNome}`,
        valor ? `Valor: R$ ${valor}` : "",
        "Solicito a fatura para conferência.",
      ]
        .filter(Boolean)
        .join("\n")
    );
    const base = digits
      ? `https://wa.me/55${digits.replace(/^55/, "")}`
      : "https://wa.me/";
    window.open(`${base}?text=${texto}`, "_blank", "noopener,noreferrer");
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 p-4">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-md border border-[#e5e7eb] bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="imprimir-fatura-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
          <h2 id="imprimir-fatura-titulo" className="text-[13px] font-normal text-[#374151]">
            Imprimir Fatura
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-0.5 text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151]"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 py-4">
          <div className="mb-4 rounded-sm border border-[#bfdbfe] bg-[#eff6ff] px-4 py-2.5 text-center text-[13px] font-semibold text-[#1d4ed8]">
            Fatura {numeroFatura}
          </div>

          {sincronizando ? (
            <p className="mb-3 text-center text-xs text-[#9ca3af]">
              Sincronizando modelos da configuração…
            </p>
          ) : null}

          <div className="mb-4 flex flex-wrap items-center justify-center gap-6 text-[12px] text-[#374151]">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="formato-fatura"
                checked={formato === "a4"}
                onChange={() => aoMudarFormato("a4")}
                className="accent-[#4a90d9]"
              />
              Folha A4
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="formato-fatura"
                checked={formato === "termica"}
                onChange={() => aoMudarFormato("termica")}
                className="accent-[#4a90d9]"
              />
              Térmica 80mm
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Modelo Fatura"
              value={modelo}
              onChange={(e) => aoMudarModelo(e.target.value)}
              disabled={sincronizando || modelosDoFormato.length === 0}
              className="h-9 rounded-sm border-[#d1d5db] text-[12px]"
            >
              {modelosDoFormato.map((id) => (
                <option key={id} value={id}>
                  {id === config.modeloPadrao
                    ? `${nomeModeloFatura(id)} (padrão)`
                    : nomeModeloFatura(id)}
                </option>
              ))}
            </Select>
            <Select
              label="Imprimir em 2 vias (em branco)"
              value={duasVias}
              onChange={(e) => setDuasVias(e.target.value)}
              className="h-9 rounded-sm border-[#d1d5db] text-[12px]"
            >
              <option value="nao">Não</option>
              <option value="sim">Sim</option>
            </Select>
          </div>

          <p className="mt-3 text-center text-[11px] text-[#9ca3af]">
            Modelos conforme{" "}
            <span className="font-medium text-[#6b7280]">Configurações → Faturas</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e7eb] px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              title="Imprimir"
              onClick={imprimir}
              disabled={sincronizando}
              className="flex h-9 w-9 items-center justify-center rounded-sm bg-[#4a90d9] text-white hover:bg-[#3d7fc4] disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Visualizar / PDF"
              onClick={visualizarPdf}
              disabled={sincronizando}
              className="flex h-9 w-9 items-center justify-center rounded-sm bg-[#1e3a5f] text-white hover:bg-[#152a45] disabled:opacity-50"
            >
              <FileText className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Enviar por WhatsApp"
              onClick={enviarWhatsapp}
              className="flex h-9 w-9 items-center justify-center rounded-sm bg-[#5cb85c] text-white hover:bg-[#4cae4c]"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-sm border border-[#f87171] bg-white px-3",
              "text-[12px] font-normal text-[#ef4444] hover:bg-[#fef2f2]"
            )}
          >
            <X className="h-3.5 w-3.5" />
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
