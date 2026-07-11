"use client";

import { I18nPortal } from "@/components/I18nPortal";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  carregarConfiguracoesEtiquetas,
  CONFIG_ETIQUETAS_ATUALIZADA_EVENT,
  etiquetasImpressaoDisponivel,
  MODELOS_ETIQUETA,
  modeloPadraoEtiqueta,
  nomeModeloEtiqueta,
  sincronizarConfiguracoesEtiquetasDoServidor,
  type ConfiguracoesEtiquetas,
  type ModeloEtiquetaId,
} from "@/lib/configuracoes-etiquetas";

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
  if (opcoes.formato === "etiquetas") {
    params.set("modelo", opcoes.modelo);
  }
  if (opcoes.duasVias) params.set("vias", "2");
  const qs = params.toString();
  return `/app/trabalhos/${trabalhoId}/imprimir${qs ? `?${qs}` : ""}`;
}

function aplicarConfigNoModal(
  cfgOs: ConfiguracoesOs,
  cfgEtiquetas: ConfiguracoesEtiquetas,
  multiplosSegmentos: boolean,
  permitirSomenteItem: boolean
) {
  const modelo = cfgOs.modeloPadrao;
  const formato = formatoPorModeloOs(modelo);
  return {
    formato,
    modelo,
    modeloEtiqueta: modeloPadraoEtiqueta(cfgEtiquetas) ?? "slk-54x101",
    somenteItem:
      permitirSomenteItem && multiplosSegmentos ? "sim" : "nao",
    duasVias: cfgOs.duasVias[modelo] ? "sim" : "nao",
  };
}

type ImprimirOsModalProps = {
  open: boolean;
  onClose: () => void;
  trabalho: TrabalhoImpressaoOs | null;
  multiplosSegmentos: boolean;
  /** Controle/agenda: permite imprimir só o item. Na tela de OS, sempre imprime todos os serviços. */
  permitirSomenteItem?: boolean;
};

export function ImprimirOsModal({
  open,
  onClose,
  trabalho,
  multiplosSegmentos,
  permitirSomenteItem = true,
}: ImprimirOsModalProps) {
  const [configOs, setConfigOs] = useState<ConfiguracoesOs>(() => carregarConfiguracoesOs());
  const [configEtiquetas, setConfigEtiquetas] = useState<ConfiguracoesEtiquetas>(() =>
    carregarConfiguracoesEtiquetas()
  );
  const [sincronizando, setSincronizando] = useState(false);
  const [formato, setFormato] = useState<FormatoImpressaoOs>("a4");
  const [modelo, setModelo] = useState<ModeloOsId>("modelo1");
  const [modeloEtiqueta, setModeloEtiqueta] = useState<ModeloEtiquetaId>("slk-54x101");
  const [somenteItem, setSomenteItem] = useState("sim");
  const [duasVias, setDuasVias] = useState("nao");
  const ultimoModeloA4 = useRef<ModeloOsId | null>(null);
  const ultimoModeloTermica = useRef<ModeloOsId | null>(null);
  const ultimoModeloEtiquetaRef = useRef<ModeloEtiquetaId | null>(null);

  const recarregarConfig = useCallback(async () => {
    setSincronizando(true);
    try {
      const [cfgOs, cfgEtiquetas] = await Promise.all([
        sincronizarConfiguracoesOsDoServidor(),
        sincronizarConfiguracoesEtiquetasDoServidor(),
      ]);
      setConfigOs(cfgOs);
      setConfigEtiquetas(cfgEtiquetas);
      return { cfgOs, cfgEtiquetas };
    } catch {
      const cfgOs = carregarConfiguracoesOs();
      const cfgEtiquetas = carregarConfiguracoesEtiquetas();
      setConfigOs(cfgOs);
      setConfigEtiquetas(cfgEtiquetas);
      return { cfgOs, cfgEtiquetas };
    } finally {
      setSincronizando(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    let ativo = true;
    void recarregarConfig().then(({ cfgOs, cfgEtiquetas }) => {
      if (!ativo) return;
      const estado = aplicarConfigNoModal(
        cfgOs,
        cfgEtiquetas,
        multiplosSegmentos,
        permitirSomenteItem
      );
      ultimoModeloA4.current =
        formatoPorModeloOs(estado.modelo) === "a4" ? estado.modelo : null;
      ultimoModeloTermica.current =
        formatoPorModeloOs(estado.modelo) === "termica" ? estado.modelo : null;
      ultimoModeloEtiquetaRef.current = estado.modeloEtiqueta;
      setFormato(estado.formato);
      setModelo(estado.modelo);
      setModeloEtiqueta(estado.modeloEtiqueta);
      setSomenteItem(estado.somenteItem);
      setDuasVias(estado.duasVias);
    });
    return () => {
      ativo = false;
    };
  }, [open, multiplosSegmentos, permitirSomenteItem, trabalho?.id, recarregarConfig]);

  useEffect(() => {
    if (!open) return;
    const handlerOs = () => setConfigOs(carregarConfiguracoesOs());
    const handlerEtiquetas = () => setConfigEtiquetas(carregarConfiguracoesEtiquetas());
    window.addEventListener(CONFIG_OS_ATUALIZADA_EVENT, handlerOs);
    window.addEventListener(CONFIG_ETIQUETAS_ATUALIZADA_EVENT, handlerEtiquetas);
    return () => {
      window.removeEventListener(CONFIG_OS_ATUALIZADA_EVENT, handlerOs);
      window.removeEventListener(CONFIG_ETIQUETAS_ATUALIZADA_EVENT, handlerEtiquetas);
    };
  }, [open]);

  function ordenarModelosComPadraoPrimeiro(
    lista: ModeloOsId[],
    padrao: ModeloOsId
  ): ModeloOsId[] {
    if (!lista.includes(padrao)) return lista;
    return [padrao, ...lista.filter((id) => id !== padrao)];
  }

  const modelosA4 = useMemo(
    () => ordenarModelosComPadraoPrimeiro(modelosOsPorFormato("a4"), configOs.modeloPadrao),
    [configOs.modeloPadrao]
  );
  const modelosTermica = useMemo(
    () => ordenarModelosComPadraoPrimeiro(modelosOsPorFormato("termica"), configOs.modeloPadrao),
    [configOs.modeloPadrao]
  );

  const etiquetasAtivas = etiquetasImpressaoDisponivel(configEtiquetas);

  useEffect(() => {
    if (!open || formato !== "etiquetas" || etiquetasAtivas) return;
    const proximo = modeloPadraoParaFormato(configOs, "a4");
    setFormato("a4");
    setModelo(proximo);
    setDuasVias(configOs.duasVias[proximo] ? "sim" : "nao");
  }, [open, formato, etiquetasAtivas, configOs]);

  function modeloOsParaFormato(fmt: "a4" | "termica") {
    const lista = modelosOsPorFormato(fmt);
    const lembrado = fmt === "a4" ? ultimoModeloA4.current : ultimoModeloTermica.current;
    if (lembrado && lista.includes(lembrado)) return lembrado;
    if (lista.includes(modelo)) return modelo;
    return modeloPadraoParaFormato(configOs, fmt);
  }

  function modeloEtiquetaParaImpressao() {
    const lembrado = ultimoModeloEtiquetaRef.current;
    if (lembrado && MODELOS_ETIQUETA.some((m) => m.id === lembrado)) return lembrado;
    return modeloPadraoEtiqueta(configEtiquetas) ?? "slk-54x101";
  }

  function aoMudarFormato(novo: FormatoImpressaoOs) {
    setFormato(novo);
    if (novo === "etiquetas") {
      const proximo = modeloEtiquetaParaImpressao();
      ultimoModeloEtiquetaRef.current = proximo;
      setModeloEtiqueta(proximo);
      setDuasVias(configEtiquetas.duasVias[proximo] ? "sim" : "nao");
      return;
    }
    const fmt = novo as "a4" | "termica";
    const proximo = modeloOsParaFormato(fmt);
    if (fmt === "a4") ultimoModeloA4.current = proximo;
    else ultimoModeloTermica.current = proximo;
    setModelo(proximo);
    setDuasVias(configOs.duasVias[proximo] ? "sim" : "nao");
  }

  function aoMudarModelo(novo: string) {
    const id = novo as ModeloOsId;
    const fmtModelo = formatoPorModeloOs(id);
    if (fmtModelo === "a4") ultimoModeloA4.current = id;
    else ultimoModeloTermica.current = id;
    setModelo(id);
    setDuasVias(configOs.duasVias[id] ? "sim" : "nao");
    if (fmtModelo !== formato) {
      setFormato(fmtModelo);
    }
  }

  function aoMudarModeloEtiqueta(novo: string) {
    const id = novo as ModeloEtiquetaId;
    ultimoModeloEtiquetaRef.current = id;
    setModeloEtiqueta(id);
    setDuasVias(configEtiquetas.duasVias[id] ? "sim" : "nao");
  }

  function imprimir() {
    if (!trabalho) return;
    if (formato === "etiquetas" && !etiquetasAtivas) return;
    const modeloImpressao = formato === "etiquetas" ? modeloEtiqueta : modelo;
    const url = montarUrlImpressaoOs(trabalho.id, {
      somenteItemSelecionado: permitirSomenteItem && somenteItem === "sim",
      multiplosSegmentos,
      segmentoEfetivo: segmentoEfetivoTrabalho(trabalho),
      formato,
      modelo: modeloImpressao,
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

  function rotuloOpcaoEtiqueta(id: ModeloEtiquetaId) {
    const nome = nomeModeloEtiqueta(id);
    return id === configEtiquetas.modeloPadrao ? `${nome} (padrão)` : nome;
  }

  return (
    <Modal open={open} onClose={onClose} title="Imprimir Ordem de Serviço" size="lg">
      {trabalho && (
        <div className="space-y-4">
          <div className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-center text-sm font-semibold text-sky-900">
            Ordem de Serviço {trabalho.numeroOs}
            {permitirSomenteItem && multiplosSegmentos && somenteItem === "sim" ? (
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
            <label
              className={`flex items-center gap-2 ${
                etiquetasAtivas ? "cursor-pointer" : "cursor-not-allowed opacity-50"
              }`}
              title={
                etiquetasAtivas
                  ? undefined
                  : "Defina uma etiqueta padrão em Configurações → Etiquetas"
              }
            >
              <input
                type="radio"
                name="formato-os"
                checked={formato === "etiquetas"}
                onChange={() => aoMudarFormato("etiquetas")}
                disabled={!etiquetasAtivas}
                className="accent-primary-600"
              />
              Etiquetas
            </label>
          </div>

          <div
            className={`grid gap-3 ${permitirSomenteItem ? "md:grid-cols-3" : "md:grid-cols-2"}`}
          >
            {formato === "etiquetas" ? (
              <Select
                label="Modelo OS"
                value={modeloEtiqueta}
                onChange={(e) => aoMudarModeloEtiqueta(e.target.value)}
                disabled={sincronizando}
              >
                {[...MODELOS_ETIQUETA]
                  .sort((a, b) => {
                    if (a.id === configEtiquetas.modeloPadrao) return -1;
                    if (b.id === configEtiquetas.modeloPadrao) return 1;
                    return 0;
                  })
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {rotuloOpcaoEtiqueta(m.id)}
                    </option>
                  ))}
              </Select>
            ) : formato === "a4" || formato === "termica" ? (
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
            ) : null}

            {permitirSomenteItem ? (
              multiplosSegmentos ? (
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
                    Não — único item nesta OS
                  </p>
                </div>
              )
            ) : null}

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
          ) : etiquetasAtivas ? (
            <p className="text-center text-xs text-slate-500">
              Tamanhos de etiqueta SLP — Seiko Smart Label Printer
              {configEtiquetas.modeloPadrao ? (
                <>
                  {" "}
                  · padrão:{" "}
                  <span className="font-medium">
                    {nomeModeloEtiqueta(configEtiquetas.modeloPadrao)}
                  </span>
                </>
              ) : null}
            </p>
          ) : (
            <p className="text-center text-xs text-amber-700">
              Impressão de etiquetas desativada. Defina um modelo padrão em{" "}
              <span className="font-medium">Configurações → Etiquetas</span>.
            </p>
          )}

          {permitirSomenteItem && multiplosSegmentos ? (
            <p className="text-center text-xs text-slate-500">
              Com <strong>Sim</strong>, a requisição inclui apenas o item desta linha (
              {itemAtual}). Com <strong>Não</strong>, inclui todos os serviços, produtos e
              transportes da mesma OS.
            </p>
          ) : !permitirSomenteItem && multiplosSegmentos ? (
            <p className="text-center text-xs text-slate-500">
              A requisição incluirá todos os serviços, produtos e transporte desta OS.
            </p>
          ) : null}

          <div className="flex justify-center gap-3 border-t border-slate-100 pt-4">
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={imprimir}
              disabled={sincronizando || (formato === "etiquetas" && !etiquetasAtivas)}
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
