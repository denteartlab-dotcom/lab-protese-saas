"use client";

import { useCallback, useState } from "react";
import { FolderOpen, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui";
import {
  formatarTamanhoArmazenamento,
  formatarTamanhoGb,
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
  const textoUsado = formatarTamanhoGb(resumo.bytesUsados);
  const textoLivre = formatarTamanhoGb(resumo.bytesLivres);

  const [modalArquivos, setModalArquivos] = useState(false);
  const [pastaServidor, setPastaServidor] = useState("");
  const [arquivos, setArquivos] = useState<ArquivoGaleria[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [excluindo, setExcluindo] = useState<string | null>(null);

  const recarregarLista = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch("/api/uploads/arquivos", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        pasta: string;
        arquivos: ArquivoGaleria[];
      };
      setPastaServidor(data.pasta || "");
      setArquivos(data.arquivos || []);
    } finally {
      setCarregando(false);
    }
  }, []);

  async function abrirModalArquivos() {
    setModalArquivos(true);
    await recarregarLista();
  }

  async function liberarEspaco() {
    try {
      const res = await fetch("/api/uploads/abrir-pasta", { method: "POST" });
      const data = (await res.json()) as {
        aberto?: boolean;
        pasta?: string;
        mensagem?: string;
      };
      if (data.pasta) setPastaServidor(data.pasta);
      if (data.aberto) {
        window.setTimeout(() => {
          onResumoAtualizado?.();
          notificarUploadsAtualizados();
        }, 2000);
        return;
      }
    } catch {
      /* abre modal */
    }
    await abrirModalArquivos();
  }

  async function excluirArquivo(relativePath: string) {
    if (!confirm("Excluir este arquivo da galeria?")) return;
    setExcluindo(relativePath);
    try {
      const res = await fetch(
        `/api/uploads/arquivos?path=${encodeURIComponent(relativePath)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        alert("Não foi possível excluir o arquivo.");
        return;
      }
      await recarregarLista();
      onResumoAtualizado?.();
      notificarUploadsAtualizados();
    } finally {
      setExcluindo(null);
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
              onClick={() => void liberarEspaco()}
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
        onClose={() => setModalArquivos(false)}
        title="Galeria de uploads"
        size="lg"
        layerClassName="z-[60]"
      >
        <div className="space-y-3 text-[12px] text-slate-600">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-slate-500">
              Pasta no servidor:
              <br />
              <code className="mt-1 block break-all rounded bg-slate-100 px-2 py-1 text-[10px] text-slate-700">
                {pastaServidor || "public/uploads"}
              </code>
            </p>
            <button
              type="button"
              onClick={() => void liberarEspaco()}
              className="inline-flex items-center gap-1.5 rounded border border-slate-200 px-3 py-1.5 text-[11px] font-medium hover:bg-slate-50"
            >
              <FolderOpen className="h-4 w-4" />
              Abrir pasta no Windows
            </button>
          </div>

          {carregando ? (
            <p className="py-6 text-center text-slate-400">Carregando arquivos...</p>
          ) : arquivos.length === 0 ? (
            <p className="py-6 text-center text-slate-400">Nenhum arquivo na galeria.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto rounded border border-slate-200">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-slate-500">
                    <th className="px-3 py-2">Arquivo</th>
                    <th className="px-3 py-2 text-right">Tamanho</th>
                    <th className="w-10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {arquivos.map((arq) => (
                    <tr key={arq.relativePath} className="border-b border-slate-50">
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-700">{arq.nome}</p>
                        <p className="text-[10px] text-slate-400">{arq.relativePath}</p>
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">
                        {formatarTamanhoArmazenamento(arq.bytes)}
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          disabled={excluindo === arq.relativePath}
                          onClick={() => void excluirArquivo(arq.relativePath)}
                          className="rounded p-1 text-red-500 hover:bg-red-50 disabled:opacity-40"
                          title="Excluir arquivo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
