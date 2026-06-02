"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Printer, X } from "lucide-react";
import { Button, Modal, Select } from "@/components/ui";
import {
  rotuloSegmentoOs,
  segmentoEfetivoTrabalho,
  type SegmentoFaturamento,
} from "@/lib/trabalho-os-segmento";
import {
  carregarConfiguracoesOs,
  CONFIG_OS_ATUALIZADA_EVENT,
  formatoPorModeloOs,
  modelosOsPorFormato,
  modeloPadraoParaFormato,
  nomeModeloOs,
  sincronizarConfiguracoesOsDoServidor,
  type ConfiguracoesOs,
  type ModeloOsId,
} from "@/lib/configuracoes-os";

export type FormatoImpressaoOs = "a4" | "termica" | "etiquetas";

export type TrabalhoImpressaoOs = {
  id: string;
  numeroOs: number;
  segmentoFaturamento?: string | null;
  instrucoes?: string | null;
  tipoProtese?: string;
};

export function montarUrlImpressaoOs(
  trabalhoId: string,
  opcoes: {
    somenteItemSelecionado: boolean;
    multiplosSegmentos: boolean;
    segmentoEfetivo?: SegmentoFaturamento;
    formato: FormatoImpressaoOs;
    modelo: string;
    duasVias: boolean;
  }
) {
  const params = new URLSearchParams();
  if (opcoes.multiplosSegmentos && opcoes.somenteItemSelecionado) {
    params.set("somenteItem", "1");
    if (opcoes.segmentoEfetivo) {
      params.set("segmento", opcoes.segmentoEfetivo);
    }
  }
  if (opcoes.formato !== "a4") params.set("formato", opcoes.formato);
  if (opcoes.formato === "a4" && opcoes.modelo !== "modelo1") {
    params.set("modelo", opcoes.modelo);
  }
  if (opcoes.formato === "termica" && opcoes.modelo !== "modelo4") {
    params.set("modelo", opcoes.modelo);
  }
  if (opcoes.duasVias) params.set("vias", "2");
  const qs = params.toString();
  return `/app/trabalhos/${trabalhoId}/imprimir${qs ? `?${qs}` : ""}`;
}

function aplicarConfigNoModal(cfg: ConfiguracoesOs, multiplosSegmentos: boolean) {
  const modelo = cfg.modeloPadrao;
  const formato = formatoPorModeloOs(modelo);
  return {
    formato,
    modelo,
    somenteItem: multiplosSegmentos ? "sim" : "nao",
    duasVias: cfg.duasVias[modelo] ? "sim" : "nao",
  };
}

type ImprimirOsModalProps = {
  open: boolean;
  onClose: () => void;
  trabalho: TrabalhoImpressaoOs | null;
  multiplosSegmentos: boolean;
};

export function ImprimirOsModal({
  open,
  onClose,
  trabalho,
  multiplosSegmentos,
}: ImprimirOsModalProps) {
  const [configOs, setConfigOs] = useState<ConfiguracoesOs>(() => carregarConfiguracoesOs());
  const [sincronizando, setSincronizando] = useState(false);
  const [formato, setFormato] = useState<FormatoImpressaoOs>("a4");
  const [modelo, setModelo] = useState<ModeloOsId>("modelo1");
  const [somenteItem, setSomenteItem] = useState("sim");
  const [duasVias, setDuasVias] = useState("nao");

  const recarregarConfig = useCallback(async () => {
    setSincronizando(true);
    try {
      const cfg = await sincronizarConfiguracoesOsDoServidor();
      setConfigOs(cfg);
      return cfg;
    } catch {
      const cfg = carregarConfiguracoesOs();
      setConfigOs(cfg);
      return cfg;
    } finally {
      setSincronizando(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    let ativo = true;
    void recarregarConfig().then((cfg) => {
      if (!ativo) return;
      const estado = aplicarConfigNoModal(cfg, multiplosSegmentos);
      setFormato(estado.formato);
      setModelo(estado.modelo);
      setSomenteItem(estado.somenteItem);
      setDuasVias(estado.duasVias);
    });
    return () => {
      ativo = false;
    };
  }, [open, multiplosSegmentos, trabalho?.id, recarregarConfig]);

  useEffect(() => {
    if (!open) return;
    const handler = () => {
      const cfg = carregarConfiguracoesOs();
      setConfigOs(cfg);
    };
    window.addEventListener(CONFIG_OS_ATUALIZADA_EVENT, handler);
    return () => window.removeEventListener(CONFIG_OS_ATUALIZADA_EVENT, handler);
  }, [open]);

  const modelosA4 = useMemo(() => modelosOsPorFormato("a4"), []);
  const modelosTermica = useMemo(() => modelosOsPorFormato("termica"), []);

  function aoMudarFormato(novo: FormatoImpressaoOs) {
    setFormato(novo);
    if (novo === "etiquetas") return;
    const fmt = novo as "a4" | "termica";
    const proximo = modeloPadraoParaFormato(configOs, fmt);
    setModelo(proximo);
    setDuasVias(configOs.duasVias[proximo] ? "sim" : "nao");
  }

  function aoMudarModelo(novo: string) {
    const id = novo as ModeloOsId;
    setModelo(id);
    setDuasVias(configOs.duasVias[id] ? "sim" : "nao");
    const fmtModelo = formatoPorModeloOs(id);
    if (formato !== "etiquetas" && fmtModelo !== formato) {
      setFormato(fmtModelo);
    }
  }

  function imprimir() {
    if (!trabalho) return;
    const url = montarUrlImpressaoOs(trabalho.id, {
      somenteItemSelecionado: somenteItem === "sim",
      multiplosSegmentos,
      segmentoEfetivo: segmentoEfetivoTrabalho(trabalho),
      formato,
      modelo,
      duasVias: duasVias === "sim",
    });
    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  }

  const segmentoLabel = trabalho ? rotuloSegmentoOs(trabalho) : "";
  const itemAtual =
    trabalho?.tipoProtese?.trim() ||
    (segmentoLabel !== "Serviço" ? segmentoLabel : "Serviço");

  const modelosDoFormato =
    formato === "a4" ? modelosA4 : formato === "termica" ? modelosTermica : [];

  function rotuloOpcaoModelo(id: ModeloOsId) {
    const nome = nomeModeloOs(id);
    return id === configOs.modeloPadrao ? `${nome} (padrão)` : nome;
  }

  return (
    <Modal open={open} onClose={onClose} title="Imprimir Ordem de Serviço" size="lg">
      {trabalho && (
        <div className="space-y-4">
          <div className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-center text-sm font-semibold text-sky-900">
            Ordem de Serviço {trabalho.numeroOs}
            {multiplosSegmentos && somenteItem === "sim" ? (
              <span className="mt-1 block text-xs font-normal text-sky-800">
                Item: {itemAtual}
              </span>
            ) : null}
          </div>

          {sincronizando ? (
            <p className="text-center text-xs text-slate-500">Sincronizando modelos da configuração…</p>
          ) : null}

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-700">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="formato-os"
                checked={formato === "a4"}
                onChange={() => aoMudarFormato("a4")}
                className="accent-primary-600"
              />
              Folha A4
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="formato-os"
                checked={formato === "termica"}
                onChange={() => aoMudarFormato("termica")}
                className="accent-primary-600"
              />
              Térmica 80mm
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="formato-os"
                checked={formato === "etiquetas"}
                onChange={() => aoMudarFormato("etiquetas")}
                className="accent-primary-600"
              />
              Etiquetas
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {formato === "a4" || formato === "termica" ? (
              <Select
                label={formato === "a4" ? "Modelo OS (A4)" : "Modelo OS (Térmica 80mm)"}
                value={modelo}
                onChange={(e) => aoMudarModelo(e.target.value)}
                disabled={sincronizando || modelosDoFormato.length === 0}
              >
                {modelosDoFormato.map((id) => (
                  <option key={id} value={id}>
                    {rotuloOpcaoModelo(id)}
                  </option>
                ))}
              </Select>
            ) : (
              <div className="space-y-1">
                <span className="block text-sm font-medium text-slate-700">Modelo OS</span>
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  Disponível em Folha A4 ou Térmica 80mm
                </p>
              </div>
            )}

            {multiplosSegmentos ? (
              <Select
                label="Somente Item Selecionado"
                value={somenteItem}
                onChange={(e) => setSomenteItem(e.target.value)}
              >
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </Select>
            ) : (
              <div className="space-y-1">
                <span className="block text-sm font-medium text-slate-700">
                  Somente Item Selecionado
                </span>
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  Não — único segmento nesta OS
                </p>
              </div>
            )}

            <Select
              label="Imprimir em 2 vias"
              value={duasVias}
              onChange={(e) => setDuasVias(e.target.value)}
            >
              <option value="nao">Não</option>
              <option value="sim">Sim</option>
            </Select>
          </div>

          {formato !== "etiquetas" ? (
            <p className="text-center text-xs text-slate-500">
              Modelos conforme{" "}
              <span className="font-medium">Configurações → Ordem de Serviço</span>
              {configOs.modeloPadrao ? (
                <>
                  {" "}
                  · padrão: <span className="font-medium">{nomeModeloOs(configOs.modeloPadrao)}</span>
                </>
              ) : null}
            </p>
          ) : null}

          {multiplosSegmentos ? (
            <p className="text-center text-xs text-slate-500">
              Com <strong>Sim</strong>, a requisição inclui apenas o item desta linha (
              {segmentoLabel}). Com <strong>Não</strong>, inclui serviço, produto e transporte da
              mesma OS.
            </p>
          ) : null}

          <div className="flex justify-center gap-3 border-t border-slate-100 pt-4">
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={imprimir}
              disabled={sincronizando || (formato !== "etiquetas" && !modelo)}
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              <X className="h-4 w-4 text-red-500" />
              Fechar
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
