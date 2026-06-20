"use client";

import { useCallback, useMemo, useState } from "react";
import { FileText, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui";
import {
  formatarTamanhoArmazenamento,
  formatarTamanhoMbCard,
  notificarUploadsAtualizados,
} from "@/lib/uploads-armazenamento";

export type UploadsResumoUi = {
  bytesUsados: number;
  bytesLivres: number;
  limiteGb: number;
  percentualUsado: number;
  percentualLivre: number;
};

type ArquivoGaleria = {
  relativePath: string;
  nome: string;
  bytes: number;
  url: string;
};

function ehImagem(nome: string) {
  return /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(nome);
}

export function PainelUploadsDashboard({
  titulo,
  resumo,
  onResumoAtualizado,
}: {
  titulo: string;
  resumo: UploadsResumoUi;
  onResumoAtualizado?: () => void;
}) {
  const usado = Math.max(0, Math.min(100, resumo.percentualUsado));
  const textoUsado = formatarTamanhoMbCard(resumo.bytesUsados);
  const textoLivre = formatarTamanhoMbCard(resumo.bytesLivres);

  const [modalArquivos, setModalArquivos] = useState(false);
  const [arquivos, setArquivos] = useState<ArquivoGaleria[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const todosSelecionados = useMemo(
    () => arquivos.length > 0 && selecionados.size === arquivos.length,
    [arquivos.length, selecionados.size]
  );

  const recarregarLista = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch("/api/uploads/arquivos", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { arquivos: ArquivoGaleria[] };
      setArquivos(data.arquivos || []);
      setSelecionados(new Set());
    } finally {
      setCarregando(false);
    }
  }, []);

  async function abrirModalArquivos() {
    setModalArquivos(true);
    await recarregarLista();
  }

  function fecharModal() {
    setModalArquivos(false);
    setSelecionados(new Set());
  }

  function alternarSelecao(relativePath: string) {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(relativePath)) proximo.delete(relativePath);
      else proximo.add(relativePath);
      return proximo;
    });
  }

  function alternarSelecionarTodos() {
    if (todosSelecionados) {
      setSelecionados(new Set());
      return;
    }
    setSelecionados(new Set(arquivos.map((arq) => arq.relativePath)));
  }

  async function excluirArquivos(paths: string[]) {
    if (paths.length === 0) return;
    const msg =
      paths.length === 1
        ? "Excluir este arquivo da galeria?"
        : `Excluir ${paths.length} arquivos selecionados?`;
    if (!confirm(msg)) return;

    setExcluindo(true);
    try {
      const res = await fetch("/api/uploads/arquivos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        excluidos?: number;
        erros?: string[];
      };
      if (!res.ok || (data.erros?.length ?? 0) > 0) {
        alert("Não foi possível excluir todos os arquivos.");
      }
      await recarregarLista();
      onResumoAtualizado?.();
      notificarUploadsAtualizados();
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <>
      <section className="rounded border border-slate-200 bg-white shadow-sm">
        <div className="flex min-h-10 items-center justify-between border-b border-slate-100 px-4 py-2">
          <h2 className="text-sm font-medium text-slate-700">{titulo}</h2>
          <span className="text-[11px] font-semibold text-slate-600">
            {resumo.limiteGb} GB
          </span>
        </div>
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2 text-[11px]">
            <span className="text-slate-500">
              <span className="font-semibold text-sky-700">Usado: {textoUsado}</span>
              <span className="mx-1 text-slate-300">·</span>
              Livre: {textoLivre}
            </span>
            <button
              type="button"
              onClick={() => void abrirModalArquivos()}
              className="shrink-0 font-medium text-[#4a90d9] hover:underline"
            >
              Liberar espaço
            </button>
          </div>
          <div className="mb-4 flex gap-4 text-[11px]">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-sky-500" /> Usado
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Livre
            </span>
          </div>
          <div className="relative h-16 overflow-hidden rounded bg-emerald-400">
            {usado > 0 && (
              <div
                className="absolute inset-y-0 left-0 bg-sky-500 transition-all duration-300"
                style={{ width: `${usado}%` }}
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-sm">
              {usado}%
            </div>
          </div>
          <div className="mt-3 flex justify-between text-[10px] text-slate-400">
            {[0, 20, 40, 60, 80, 100].map((n) => (
              <span key={n}>{n}</span>
            ))}
          </div>
        </div>
      </section>

      <Modal
        open={modalArquivos}
        onClose={fecharModal}
        title="Liberar espaço — galeria de uploads"
        size="xl"
        layerClassName="z-[60]"
      >
        <div className="space-y-3 text-[12px] text-slate-600">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-slate-600">
              <input
                type="checkbox"
                checked={todosSelecionados}
                onChange={alternarSelecionarTodos}
                disabled={carregando || arquivos.length === 0}
                className="h-4 w-4 rounded border-slate-300"
              />
              Selecionar todos
              {selecionados.size > 0 && (
                <span className="text-slate-400">({selecionados.size} selecionado(s))</span>
              )}
            </label>
            <button
              type="button"
              disabled={excluindo || selecionados.size === 0}
              onClick={() => void excluirArquivos([...selecionados])}
              className="inline-flex items-center gap-1.5 rounded border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-medium text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
              Excluir selecionados
            </button>
          </div>

          {carregando ? (
            <p className="py-10 text-center text-slate-400">Carregando arquivos...</p>
          ) : arquivos.length === 0 ? (
            <p className="py-10 text-center text-slate-400">Nenhum arquivo na galeria.</p>
          ) : (
            <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {arquivos.map((arq) => {
                const marcado = selecionados.has(arq.relativePath);
                const imagem = ehImagem(arq.nome);
                return (
                  <div
                    key={arq.relativePath}
                    className={`relative overflow-hidden rounded-lg border bg-slate-50 transition ${
                      marcado ? "border-sky-400 ring-2 ring-sky-200" : "border-slate-200"
                    }`}
                  >
                    <label className="absolute left-2 top-2 z-10 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() => alternarSelecao(arq.relativePath)}
                        className="h-4 w-4 rounded border-slate-300 bg-white shadow"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={excluindo}
                      onClick={() => void excluirArquivos([arq.relativePath])}
                      className="absolute right-2 top-2 z-10 rounded bg-white/90 p-1 text-red-500 shadow hover:bg-red-50 disabled:opacity-40"
                      title="Excluir arquivo"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <div className="flex aspect-square items-center justify-center bg-white p-2">
                      {imagem ? (
                        <img
                          src={arq.url}
                          alt={arq.nome}
                          className="max-h-full max-w-full object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <FileText className="h-10 w-10 text-slate-300" />
                      )}
                    </div>
                    <div className="border-t border-slate-100 px-2 py-1.5">
                      <p className="truncate text-[10px] font-medium text-slate-700" title={arq.nome}>
                        {arq.nome}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {formatarTamanhoArmazenamento(arq.bytes)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
