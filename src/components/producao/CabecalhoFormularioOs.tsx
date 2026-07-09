"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ImageUp, Tag, Trash2 } from "lucide-react";
import { CampoDataBr, Input, Select, SelectPesquisavel } from "@/components/ui";
import { type PrioridadeOsForm } from "@/lib/prioridade-os";
import {
  adicionarMaterialDentistaCadastro,
  carregarMateriaisDentistaCadastro,
  MATERIAIS_DENTISTA_ATUALIZADA_EVENT,
} from "@/lib/materiais-dentista-cadastro";
import { useArmazenamentoGaleria } from "@/hooks/use-armazenamento-galeria";
import {
  clienteTabelaPrecoDeObservacoes,
  formatMateriaisEnviadosTexto,
  parseMateriaisEnviadosTexto,
  type CabecalhoOsCampos,
} from "@/lib/cabecalho-os-form";

type ClienteOpcao = {
  id: string;
  nome: string;
  observacoes?: string | null;
};

type AnexoExistente = {
  name: string;
  type: string;
  url: string;
};

type Props = {
  value: CabecalhoOsCampos;
  onChange: (patch: Partial<CabecalhoOsCampos>) => void;
  clientes: ClienteOpcao[];
  anexosExistentes?: AnexoExistente[];
  onRemoverAnexoExistente?: (anexo: AnexoExistente) => void;
  arquivosNovos?: File[];
  onArquivosNovosChange?: (arquivos: File[]) => void;
  limiteArquivos?: number;
  desabilitado?: boolean;
  observacaoEditavel?: boolean;
};

const LIMITE_ARQUIVOS_PADRAO = 5;

export function CabecalhoFormularioOs({
  value,
  onChange,
  clientes,
  anexosExistentes = [],
  onRemoverAnexoExistente,
  arquivosNovos = [],
  onArquivosNovosChange,
  limiteArquivos = LIMITE_ARQUIVOS_PADRAO,
  desabilitado = false,
  observacaoEditavel = true,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [materiais, setMateriais] = useState<string[]>([]);
  const [materiaisCarregados, setMateriaisCarregados] = useState(false);
  const [materialAberto, setMaterialAberto] = useState(false);
  const [buscaMaterial, setBuscaMaterial] = useState("");
  const [novoMaterial, setNovoMaterial] = useState("");
  const [materiaisSelecionados, setMateriaisSelecionados] = useState<string[]>([]);
  const [materialQuantidades, setMaterialQuantidades] = useState<Record<string, number>>({});
  const { esgotado: galeriaEsgotada, mensagemBloqueioUpload, podeEnviarArquivos } =
    useArmazenamentoGaleria();

  useEffect(() => {
    try {
      setMateriais(carregarMateriaisDentistaCadastro());
    } catch {
      setMateriais([]);
    }
    setMateriaisCarregados(true);
  }, []);

  useEffect(() => {
    const parsed = parseMateriaisEnviadosTexto(value.material);
    setMateriaisSelecionados(parsed.selecionados);
    setMaterialQuantidades(parsed.quantidades);
  }, [value.material]);

  useEffect(() => {
    const handler = () => setMateriais(carregarMateriaisDentistaCadastro());
    window.addEventListener(MATERIAIS_DENTISTA_ATUALIZADA_EVENT, handler);
    return () => window.removeEventListener(MATERIAIS_DENTISTA_ATUALIZADA_EVENT, handler);
  }, []);

  const tabelaPrecoSelecionada = useMemo(() => {
    const cliente = clientes.find((item) => item.id === value.clienteId);
    return clienteTabelaPrecoDeObservacoes(cliente?.observacoes);
  }, [clientes, value.clienteId]);

  const materiaisFiltrados = materiais.filter((material) =>
    material.toLowerCase().includes(buscaMaterial.trim().toLowerCase())
  );

  const totalAnexos = anexosExistentes.length + arquivosNovos.length;

  function atualizarMaterial(material: string) {
    onChange({ material });
  }

  function toggleMaterial(material: string) {
    const selecionados = materiaisSelecionados.includes(material)
      ? materiaisSelecionados.filter((item) => item !== material)
      : [...materiaisSelecionados, material];
    const quantidades = { ...materialQuantidades };
    if (selecionados.includes(material)) quantidades[material] = quantidades[material] || 1;
    else delete quantidades[material];
    setMateriaisSelecionados(selecionados);
    setMaterialQuantidades(quantidades);
    atualizarMaterial(formatMateriaisEnviadosTexto(selecionados, quantidades));
  }

  function alterarQuantidadeMaterial(material: string, delta: number) {
    if (!materiaisSelecionados.includes(material)) return;
    const quantidades = {
      ...materialQuantidades,
      [material]: Math.max((materialQuantidades[material] || 1) + delta, 1),
    };
    setMaterialQuantidades(quantidades);
    atualizarMaterial(formatMateriaisEnviadosTexto(materiaisSelecionados, quantidades));
  }

  async function adicionarMaterialLista() {
    const material = (novoMaterial || buscaMaterial).trim();
    if (!material) return;
    try {
      const proxima = await adicionarMaterialDentistaCadastro(material, materiais);
      setMateriais(proxima);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Não foi possível salvar o material.");
      return;
    }
    setNovoMaterial("");
    setBuscaMaterial("");
    if (!materiaisSelecionados.includes(material)) toggleMaterial(material);
  }

  function adicionarArquivos(event: React.ChangeEvent<HTMLInputElement>) {
    if (!onArquivosNovosChange) return;
    const selecionados = Array.from(event.target.files || []);
    if (!selecionados.length) return;
    const bloqueio = mensagemBloqueioUpload();
    if (bloqueio) {
      window.alert(bloqueio);
      event.target.value = "";
      return;
    }
    const existentes = new Set(
      arquivosNovos.map((arquivo) => `${arquivo.name}-${arquivo.size}-${arquivo.lastModified}`)
    );
    const novos = selecionados.filter(
      (arquivo) => !existentes.has(`${arquivo.name}-${arquivo.size}-${arquivo.lastModified}`)
    );
    const limiteRestante = Math.max(limiteArquivos - anexosExistentes.length, 0);
    const paraAdicionar = novos.slice(0, Math.max(limiteRestante - arquivosNovos.length, 0));
    if (!paraAdicionar.length) {
      event.target.value = "";
      return;
    }
    if (!podeEnviarArquivos(paraAdicionar)) {
      window.alert(
        "Espaço insuficiente na galeria para estes arquivos. Libere espaço em Início → Uploads."
      );
      event.target.value = "";
      return;
    }
    onArquivosNovosChange([...arquivosNovos, ...paraAdicionar].slice(0, limiteRestante));
    event.target.value = "";
  }

  const previews = arquivosNovos.map((file) => ({
    file,
    url: URL.createObjectURL(file),
    isImage: file.type.startsWith("image/"),
    isVideo: file.type.startsWith("video/"),
  }));

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [arquivosNovos]);

  return (
    <section className="grid gap-3 p-4 md:grid-cols-5">
      <CampoDataBr
        label="Data Lançamento"
        value={value.dataLancamento}
        onChange={(dataLancamento) => onChange({ dataLancamento })}
        disabled={desabilitado}
      />
      <Input label="Número OS" value={value.numeroOs || "—"} readOnly />
      <Input
        label="Caixa"
        value={value.caixa}
        onChange={(e) => onChange({ caixa: e.target.value })}
        readOnly={desabilitado}
      />
      <Input
        label="Caso Clínico"
        value={value.casoUrgente}
        onChange={(e) => onChange({ casoUrgente: e.target.value })}
        readOnly={desabilitado}
      />
      <Input
        label="Paciente"
        value={value.pacienteNome}
        onChange={(e) => onChange({ pacienteNome: e.target.value })}
        placeholder="Digite o nome do paciente"
        readOnly={desabilitado}
      />

      <div className="space-y-1">
        <SelectPesquisavel
          label="Selecione um Cliente *"
          value={value.clienteId}
          onChange={(clienteId) => onChange({ clienteId })}
          placeholder="Selecione..."
          disabled={desabilitado}
          options={clientes.map((cliente) => ({
            value: cliente.id,
            label: cliente.nome,
          }))}
        />
        <Select
          label="Prioridade"
          value={value.prioridadeOs || "media"}
          onChange={(e) =>
            onChange({
              prioridadeOs: (e.target.value || "media") as PrioridadeOsForm,
            })
          }
          disabled={desabilitado}
        >
          <option value="alta">Alta</option>
          <option value="media">Média</option>
          <option value="baixa">Baixa</option>
        </Select>
        {value.clienteId ? (
          <p className="text-[12px] font-medium leading-snug text-[#4a90d9]">
            Tabela Utilizada <span className="font-semibold">{tabelaPrecoSelecionada}</span>
          </p>
        ) : null}
      </div>

      <Input
        label="Dentista"
        value={value.dentista}
        onChange={(e) => onChange({ dentista: e.target.value })}
        placeholder="Nome do dentista (opcional)"
        readOnly={desabilitado}
      />

      <div className="relative space-y-2 md:col-span-3">
        <label className="block text-sm font-medium text-slate-700">
          Material Enviado pelo Dentista
        </label>
        <div className="rounded border border-slate-300 bg-white p-2 shadow-sm">
          {materiaisSelecionados.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {materiaisSelecionados.map((material) => (
                <span
                  key={material}
                  className="inline-flex items-center rounded bg-blue-600 px-2 py-1 text-[10px] font-semibold text-white"
                >
                  {materialQuantidades[material] || 1} {material}
                </span>
              ))}
            </div>
          )}
          <button
            type="button"
            disabled={desabilitado}
            onClick={() => setMaterialAberto((aberto) => !aberto)}
            className="flex w-full items-center justify-center gap-2 rounded border border-slate-500 bg-slate-100 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Tag className="h-3.5 w-3.5 text-slate-500" />
            Selecione Materiais
            <span className="text-slate-400">⌄</span>
          </button>
        </div>
        {materialAberto && !desabilitado && (
          <div className="absolute left-0 z-30 mt-1 w-full rounded border border-slate-300 bg-white p-4 shadow-xl">
            <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <Input
                value={buscaMaterial}
                onChange={(e) => setBuscaMaterial(e.target.value)}
                placeholder="Procurar"
                className="h-8"
              />
              <button
                type="button"
                onClick={() => {
                  setBuscaMaterial("");
                  setMateriaisSelecionados([]);
                  setMaterialQuantidades({});
                  atualizarMaterial("");
                }}
                className="rounded border border-slate-300 px-3 text-xs text-slate-600 hover:bg-slate-50"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={adicionarMaterialLista}
                className="rounded border border-emerald-300 px-3 text-xs text-emerald-700 hover:bg-emerald-50"
              >
                + Material na Lista
              </button>
            </div>
            <div className="max-h-80 space-y-1 overflow-auto pr-2">
              {materiaisFiltrados.map((material) => {
                const selecionado = materiaisSelecionados.includes(material);
                return (
                  <div
                    key={material}
                    className="grid grid-cols-[1fr_minmax(160px,260px)] items-center gap-4 rounded px-1 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    <label className="flex min-w-0 flex-1 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selecionado}
                        onChange={() => toggleMaterial(material)}
                        className="h-4 w-4 accent-blue-600"
                      />
                      <span className="truncate">{material}</span>
                    </label>
                    <div className="grid grid-cols-[32px_1fr_32px] items-center overflow-hidden rounded border border-slate-300 bg-white">
                      <button
                        type="button"
                        disabled={!selecionado}
                        onClick={() => alterarQuantidadeMaterial(material, -1)}
                        className="h-6 border-r border-slate-200 text-slate-600 disabled:opacity-40"
                      >
                        -
                      </button>
                      <span className="text-center text-xs">
                        {materialQuantidades[material] || 1}
                      </span>
                      <button
                        type="button"
                        disabled={!selecionado}
                        onClick={() => alterarQuantidadeMaterial(material, 1)}
                        className="h-6 border-l border-slate-200 text-slate-600 disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
              {materiaisFiltrados.length === 0 && (
                <p className="py-3 text-center text-xs text-slate-400">
                  Nenhum material encontrado.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 md:col-span-5 lg:flex-row lg:items-end">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          disabled={desabilitado || galeriaEsgotada || totalAnexos >= limiteArquivos}
          onChange={adicionarArquivos}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={desabilitado || galeriaEsgotada || totalAnexos >= limiteArquivos}
          className="shrink-0 rounded border border-slate-300 px-3 py-2 text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ImageUp className="mr-2 inline h-4 w-4" /> Selecione Imagens ou Vídeos ({totalAnexos}/
          {limiteArquivos})
        </button>
        {galeriaEsgotada ? (
          <p className="text-[11px] text-red-600">{mensagemBloqueioUpload()}</p>
        ) : null}
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Observação Interna
          </label>
          <input
            type="text"
            value={value.observacoes}
            onChange={(e) => onChange({ observacoes: e.target.value })}
            readOnly={!observacaoEditavel}
            placeholder="Somente para o laboratório (não aparece na OS impressa)"
            className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 read-only:bg-slate-50"
          />
        </div>
      </div>

      {(anexosExistentes.length > 0 || previews.length > 0) && (
        <div className="md:col-span-5 rounded border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
          <p className="mb-2 font-medium">
            Arquivos ({totalAnexos}/{limiteArquivos}):
          </p>
          <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-5">
            {anexosExistentes.map((anexo) => (
              <div
                key={`${anexo.url}-${anexo.name}`}
                className="relative overflow-hidden rounded border border-emerald-100 bg-white shadow-sm"
              >
                {onRemoverAnexoExistente && !desabilitado ? (
                  <button
                    type="button"
                    onClick={() => onRemoverAnexoExistente(anexo)}
                    className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-red-600 shadow hover:bg-red-50"
                    title="Remover anexo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
                {anexo.type.startsWith("image/") ? (
                  <img src={anexo.url} alt={anexo.name} className="h-24 w-full object-cover" />
                ) : anexo.type.startsWith("video/") ? (
                  <video src={anexo.url} className="h-24 w-full bg-black object-cover" />
                ) : (
                  <div className="flex h-24 items-center justify-center text-slate-400">Arquivo</div>
                )}
                <div className="truncate px-2 py-1 text-[11px] text-slate-600">{anexo.name}</div>
              </div>
            ))}
            {previews.map((preview, index) => (
              <div
                key={`${preview.file.name}-${preview.file.size}`}
                className="relative overflow-hidden rounded border border-emerald-100 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() =>
                    onArquivosNovosChange?.(
                      arquivosNovos.filter((_, itemIndex) => itemIndex !== index)
                    )
                  }
                  className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-red-600 shadow hover:bg-red-50"
                  title="Excluir arquivo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                {preview.isImage && (
                  <Image
                    src={preview.url}
                    alt={preview.file.name}
                    width={240}
                    height={160}
                    unoptimized
                    className="h-24 w-full object-cover"
                  />
                )}
                {preview.isVideo && (
                  <video src={preview.url} className="h-24 w-full bg-black object-cover" />
                )}
                {!preview.isImage && !preview.isVideo && (
                  <div className="flex h-24 items-center justify-center text-slate-400">Arquivo</div>
                )}
                <div className="truncate px-2 py-1 text-[11px] text-slate-600">
                  {preview.file.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
