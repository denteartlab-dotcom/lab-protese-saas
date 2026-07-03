"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui";
import {
  ErroJobCliente,
  fornecedorImportacaoParaPayload,
  importarFornecedoresComJob,
} from "@/lib/fornecedores-import-cliente";
import {
  parsearArquivoFornecedoresExcel,
  type FornecedorImportacaoLinha,
} from "@/lib/fornecedores-lista-export";

type Props = {
  aberto: boolean;
  onFechar: () => void;
  onImportado: () => void;
};

export function ImportarFornecedoresExcelModal({ aberto, onFechar, onImportado }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [linhas, setLinhas] = useState<FornecedorImportacaoLinha[]>([]);
  const [erro, setErro] = useState("");
  const [importando, setImportando] = useState(false);
  const [progresso, setProgresso] = useState(0);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  function resetar() {
    abortRef.current?.abort();
    abortRef.current = null;
    setArquivo(null);
    setLinhas([]);
    setErro("");
    setProgresso(0);
    if (inputRef.current) inputRef.current.value = "";
  }

  function fechar() {
    if (importando) return;
    resetar();
    onFechar();
  }

  async function processarArquivo(file: File | null) {
    if (!file) return;
    setErro("");
    setArquivo(file);
    try {
      const parsed = await parsearArquivoFornecedoresExcel(file);
      if (!parsed.length) {
        setLinhas([]);
        setErro("Nenhum fornecedor válido encontrado no arquivo. Verifique o cabeçalho e a coluna Nome.");
        return;
      }
      setLinhas(parsed);
    } catch {
      setLinhas([]);
      setErro("Não foi possível ler o arquivo. Use Excel (.xls, .xlsx) ou CSV.");
    }
  }

  function mensagemErroImportacao(erroImport: unknown): string {
    if (erroImport instanceof ErroJobCliente) return erroImport.message;
    return "Erro de conexão ao importar os fornecedores.";
  }

  async function importarDados() {
    if (!linhas.length) {
      setErro("Selecione um arquivo Excel com fornecedores para importar.");
      return;
    }

    setImportando(true);
    setErro("");
    setProgresso(0);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resultado = await importarFornecedoresComJob(
        linhas.map(fornecedorImportacaoParaPayload),
        {
          signal: controller.signal,
          onProgresso: (pct) => setProgresso(pct),
        }
      );

      const total = resultado.ok ?? 0;
      const ignorados = resultado.ignorados ?? 0;
      const avisos = (resultado.erros ?? [])
        .slice(0, 3)
        .map((e) => `Linha ${e.linha}: ${e.mensagem}`)
        .join("\n");

      if (total === 0 && ignorados > 0) {
        setErro("Nenhum fornecedor novo para importar. Verifique nomes duplicados.");
        return;
      }

      if (ignorados > 0) {
        alert(
          `${total} fornecedor(es) importado(s). ${ignorados} linha(s) ignorada(s).` +
            (avisos ? `\n\n${avisos}` : "")
        );
      } else {
        alert(`${total} fornecedor(es) importado(s) com sucesso.`);
      }

      onImportado();
      resetar();
      onFechar();
    } catch (erroImport) {
      if (erroImport instanceof ErroJobCliente && erroImport.codigo === "abortado") return;
      setErro(mensagemErroImportacao(erroImport));
    } finally {
      setImportando(false);
      abortRef.current = null;
    }
  }

  const rotuloBotaoImportar =
    importando && progresso > 0
      ? `Importando… ${progresso}%`
      : importando
        ? "Importando…"
        : "Importar Dados";

  return (
    <Modal open={aberto} onClose={fechar} title="Importar Lista de Fornecedores em Excel">
      <div className="space-y-4">
        <div className="flex gap-0 overflow-hidden rounded border border-[#d1d5db]">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="hidden"
            disabled={importando}
            onChange={(e) => void processarArquivo(e.target.files?.[0] ?? null)}
          />
          <input
            readOnly
            value={arquivo?.name || ""}
            placeholder="Escolha um arquivo Excel ou arraste aqui"
            className="h-[34px] min-w-0 flex-1 border-0 bg-white px-3 text-[12px] text-[#374151] outline-none placeholder:text-[#9ca3af] disabled:opacity-60"
            onClick={() => !importando && inputRef.current?.click()}
          />
          <button
            type="button"
            disabled={importando}
            onClick={() => inputRef.current?.click()}
            className="shrink-0 border-l border-[#d1d5db] bg-white px-4 text-[12px] font-normal text-[#374151] hover:bg-[#f9fafb] disabled:opacity-60"
          >
            Importar Arquivo
          </button>
        </div>

        {linhas.length > 0 ? (
          <p className="text-[12px] text-[#16a34a]">
            {linhas.length} fornecedor(es) pronto(s) para importação.
          </p>
        ) : null}

        {importando ? (
          <div className="space-y-1">
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#5bc0de] transition-[width] duration-300"
                style={{ width: `${Math.max(progresso, 8)}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Processando em segundo plano… você pode aguardar nesta tela.
            </p>
          </div>
        ) : null}

        {erro ? <p className="text-[12px] text-red-600">{erro}</p> : null}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={fechar}
            disabled={importando}
            className="h-[34px] flex-1 rounded-sm bg-[#6b7280] text-[13px] font-semibold text-white hover:bg-[#4b5563] disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void importarDados()}
            disabled={importando || !linhas.length}
            className="h-[34px] flex-1 rounded-sm bg-[#5bc0de] text-[13px] font-semibold text-white hover:bg-[#46b8da] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {rotuloBotaoImportar}
          </button>
        </div>
      </div>
    </Modal>
  );
}
