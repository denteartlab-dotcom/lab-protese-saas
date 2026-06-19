"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

const PdfOsViewer = dynamic(
  () => import("./pdf-os-viewer").then((m) => m.PdfOsViewer),
  { ssr: false, loading: () => (
    <div className="flex flex-1 items-center justify-center text-sm text-slate-300">
      Gerando PDF da OS...
    </div>
  ) }
);

function ErroImpressao({
  titulo,
  detalhe,
}: {
  titulo: string;
  detalhe: string;
}) {
  return (
    <div className="mx-auto mt-10 max-w-xl rounded border border-red-200 bg-red-50 p-6 text-center text-red-700">
      <p className="font-semibold">{titulo}</p>
      <p className="mt-2 text-sm">{detalhe}</p>
      <Button type="button" className="mt-4" onClick={() => window.location.reload()}>
        Tentar novamente
      </Button>
    </div>
  );
}

type DadosImpressaoOsPdf = {
  numeroOs: number;
  usuarioCriou?: string;
  dataEntrada: string;
  status: string;
  cliente: string;
  dentista: string;
  paciente: string;
  caixa: string;
  telefones: string;
  email: string;
  endereco: string;
  valor: number;
  prazo: string;
  prazoLaboratorio: string;
  prazoDentista: string;
  materiais: string;
  observacoes: string;
  itens: Array<{
    qtd: string;
    descricao: string;
    dente: string;
    cor: string;
    unitario: number;
    desconto: string;
    descontoTipo?: string;
    notasAbaixo?: string[];
  }>;
  [key: string]: unknown;
};

type Estado =
  | { status: "loading" }
  | {
      status: "ok";
      dados: DadosImpressaoOsPdf;
      formato: string;
      modelo: string;
      duasVias: boolean;
    }
  | { status: "erro"; titulo: string; detalhe: string };

export function ImprimirOsLoader({
  trabalhoId,
  queryString,
}: {
  trabalhoId: string;
  queryString: string;
}) {
  const [estado, setEstado] = useState<Estado>({ status: "loading" });

  useEffect(() => {
    let ativo = true;
    const qs = queryString ? `?${queryString}` : "";

    void fetch(`/api/trabalhos/${trabalhoId}/impressao${qs}`, {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!ativo) return;
        if (!res.ok) {
          setEstado({
            status: "erro",
            titulo:
              typeof payload.error === "string"
                ? payload.error
                : "Erro ao abrir a impressão.",
            detalhe:
              typeof payload.detalhe === "string"
                ? payload.detalhe
                : "Não foi possível carregar os dados da OS.",
          });
          return;
        }
        setEstado({
          status: "ok",
          dados: payload.dados,
          formato: payload.formato || "a4",
          modelo: payload.modelo || "modelo1",
          duasVias: Boolean(payload.duasVias),
        });
      })
      .catch((err) => {
        if (!ativo) return;
        setEstado({
          status: "erro",
          titulo: "Erro ao abrir a impressão.",
          detalhe:
            err instanceof Error
              ? err.message
              : "Falha de rede ao carregar a OS. Verifique a conexão.",
        });
      });

    return () => {
      ativo = false;
    };
  }, [trabalhoId, queryString]);

  if (estado.status === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-300">
        Carregando dados da OS...
      </div>
    );
  }

  if (estado.status === "erro") {
    return <ErroImpressao titulo={estado.titulo} detalhe={estado.detalhe} />;
  }

  return (
    <PdfOsViewer
      formato={estado.formato}
      modelo={estado.modelo}
      duasVias={estado.duasVias}
      data={estado.dados}
    />
  );
}
