"use client";

import { useRef, useState } from "react";
import { Modal } from "@/components/ui";
import {
  clienteImportacaoParaPayload,
  parsearArquivoClientesExcel,
  type ClienteImportacaoLinha,
} from "@/lib/clientes-lista-export";

type Props = {
  aberto: boolean;
  onFechar: () => void;
  onImportado: () => void;
};

export function ImportarClientesExcelModal({ aberto, onFechar, onImportado }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [linhas, setLinhas] = useState<ClienteImportacaoLinha[]>([]);
  const [erro, setErro] = useState("");
  const [importando, setImportando] = useState(false);

  function resetar() {
    setArquivo(null);
    setLinhas([]);
    setErro("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function fechar() {
    resetar();
    onFechar();
  }

  async function processarArquivo(file: File | null) {
    if (!file) return;
    setErro("");
    setArquivo(file);
    try {
      const parsed = await parsearArquivoClientesExcel(file);
      if (!parsed.length) {
        setLinhas([]);
        setErro("Nenhum cliente válido encontrado no arquivo. Verifique o cabeçalho e a coluna Nome.");
        return;
      }
      setLinhas(parsed);
    } catch {
      setLinhas([]);
      setErro("Não foi possível ler o arquivo. Use Excel (.xls, .xlsx) ou CSV.");
    }
  }

  async function importarDados() {
    if (!linhas.length) {
      setErro("Selecione um arquivo Excel com clientes para importar.");
      return;
    }

    setImportando(true);
    setErro("");
    try {
      const res = await fetch("/api/clientes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientes: linhas.map(clienteImportacaoParaPayload),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        importados?: number;
        ignorados?: number;
      };

      if (!res.ok) {
        setErro(data.error || "Não foi possível importar os clientes.");
        return;
      }

      const total = data.importados ?? 0;
      const ignorados = data.ignorados ?? 0;
      if (ignorados > 0) {
        alert(`${total} cliente(s) importado(s). ${ignorados} linha(s) ignorada(s).`);
      } else {
        alert(`${total} cliente(s) importado(s) com sucesso.`);
      }

      onImportado();
      fechar();
    } catch {
      setErro("Erro de conexão ao importar os clientes.");
    } finally {
      setImportando(false);
    }
  }

  return (
    <Modal open={aberto} onClose={fechar} title="Importar Lista de Clientes em Excel">
      <div className="space-y-4">
        <div className="flex gap-0 overflow-hidden rounded border border-[#d1d5db]">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="hidden"
            onChange={(e) => void processarArquivo(e.target.files?.[0] ?? null)}
          />
          <input
            readOnly
            value={arquivo?.name || ""}
            placeholder="Escolha um arquivo Excel ou arraste aqui"
            className="h-[34px] min-w-0 flex-1 border-0 bg-white px-3 text-[12px] text-[#374151] outline-none placeholder:text-[#9ca3af]"
            onClick={() => inputRef.current?.click()}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="shrink-0 border-l border-[#d1d5db] bg-white px-4 text-[12px] font-normal text-[#374151] hover:bg-[#f9fafb]"
          >
            Importar Arquivo
          </button>
        </div>

        {linhas.length > 0 ? (
          <p className="text-[12px] text-[#16a34a]">
            {linhas.length} cliente(s) pronto(s) para importação.
          </p>
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
            {importando ? "Importando…" : "Importar Dados"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
