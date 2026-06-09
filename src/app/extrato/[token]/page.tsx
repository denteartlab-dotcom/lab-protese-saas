"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Download, Printer } from "lucide-react";

type DadosExtratoPublico = {
  titulo: string;
  nomeArquivo: string;
  clienteNome: string;
  temPdf: boolean;
};

function ExtratoPublicaViewer() {
  const params = useParams<{ token: string }>();
  const token = params.token?.trim() ?? "";
  const [dados, setDados] = useState<DadosExtratoPublico | null>(null);
  const [erro, setErro] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");

  useEffect(() => {
    if (!token) return;
    let ativo = true;

    void (async () => {
      try {
        const resDados = await fetch(`/api/financeiro/extrato-publica/${token}/dados`);
        const json = (await resDados.json().catch(() => ({}))) as DadosExtratoPublico & {
          error?: string;
        };
        if (!resDados.ok) {
          throw new Error(json.error || "Não foi possível carregar o extrato.");
        }
        if (!ativo) return;
        setDados(json);

        if (!json.temPdf) {
          throw new Error("Extrato publicado sem PDF. Gere um novo link pelo laboratório.");
        }

        const pdfRes = await fetch(`/api/financeiro/extrato-publica/${token}`);
        if (!pdfRes.ok) {
          throw new Error("Não foi possível carregar o PDF do extrato.");
        }
        const blob = await pdfRes.blob();
        if (!blob.size) {
          throw new Error("PDF do extrato vazio. Gere um novo link pelo laboratório.");
        }
        if (!ativo) return;
        setPdfUrl(URL.createObjectURL(blob));
      } catch (err) {
        if (!ativo) return;
        setErro(err instanceof Error ? err.message : "Erro ao carregar extrato.");
      }
    })();

    return () => {
      ativo = false;
    };
  }, [token]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  function imprimir() {
    if (!pdfUrl) return;
    const iframe = document.getElementById(
      "extrato-publica-iframe"
    ) as HTMLIFrameElement | null;
    try {
      iframe?.contentWindow?.focus();
      iframe?.contentWindow?.print();
    } catch {
      window.open(pdfUrl, "_blank");
    }
  }

  if (!token) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#525659] px-6 text-center text-white">
        <p className="text-sm text-red-300">Link do extrato inválido.</p>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#525659] px-6 text-center text-white">
        <p className="text-sm text-red-300">{erro}</p>
      </div>
    );
  }

  if (!dados || !pdfUrl) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#525659] text-sm text-slate-200">
        Carregando extrato...
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#525659]">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-700 bg-[#3c3c3c] px-4 py-3 text-white">
        <div>
          <h1 className="text-sm font-semibold">{dados.titulo || "Extrato Financeiro"}</h1>
          <p className="text-xs text-slate-300">Visualização do extrato para conferência</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={pdfUrl}
            download={dados.nomeArquivo || `extrato-${token}.pdf`}
            className="inline-flex items-center gap-1.5 rounded border border-slate-500 px-3 py-1.5 text-xs text-white hover:bg-slate-700"
          >
            <Download className="h-3.5 w-3.5" />
            Baixar PDF
          </a>
          <button
            type="button"
            onClick={imprimir}
            className="inline-flex items-center gap-1.5 rounded border border-slate-500 px-3 py-1.5 text-xs text-white hover:bg-slate-700"
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir
          </button>
        </div>
      </div>
      <iframe
        id="extrato-publica-iframe"
        src={pdfUrl}
        title={dados.titulo || "Extrato Financeiro"}
        className="h-full w-full flex-1 border-0 bg-white"
      />
    </div>
  );
}

export default function ExtratoPublicaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#525659] text-sm text-slate-200">
          Carregando...
        </div>
      }
    >
      <ExtratoPublicaViewer />
    </Suspense>
  );
}
