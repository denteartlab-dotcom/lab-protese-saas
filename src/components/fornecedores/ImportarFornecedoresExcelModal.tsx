"use client";

import { useRef, useState } from "react";
import { Modal } from "@/components/ui";
import {
  fornecedorImportacaoParaFornecedor,
  parsearArquivoFornecedoresExcel,
  type FornecedorImportacaoLinha,
  type FornecedorListagemExport,
} from "@/lib/fornecedores-lista-export";

type Props = {
  aberto: boolean;
  onFechar: () => void;
  onImportado: (fornecedores: (FornecedorListagemExport & { id: string })[]) => void;
  nomesExistentes: string[];
};

export function ImportarFornecedoresExcelModal({
  aberto,
  onFechar,
  onImportado,
  nomesExistentes,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [linhas, setLinhas] = useState<FornecedorImportacaoLinha[]>([]);
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

  function importarDados() {
    if (!linhas.length) {
      setErro("Selecione um arquivo Excel com fornecedores para importar.");
      return;
    }

    setImportando(true);
    setErro("");

    try {
      const nomes = new Set(nomesExistentes.map((nome) => nome.trim().toLowerCase()));
      const novos: (FornecedorListagemExport & { id: string })[] = [];
      let ignorados = 0;

      for (const linha of linhas) {
        const nomeNormalizado = linha.nome.trim().toLowerCase();
        if (nomes.has(nomeNormalizado)) {
          ignorados += 1;
          continue;
        }
        const fornecedor = fornecedorImportacaoParaFornecedor(linha);
        novos.push(fornecedor);
        nomes.add(nomeNormalizado);
      }

      if (!novos.length) {
        setErro("Nenhum fornecedor novo para importar. Verifique nomes duplicados.");
        return;
      }

      onImportado(novos);

      if (ignorados > 0) {
        alert(`${novos.length} fornecedor(es) importado(s). ${ignorados} linha(s) ignorada(s).`);
      } else {
        alert(`${novos.length} fornecedor(es) importado(s) com sucesso.`);
      }

      fechar();
    } catch {
      setErro("Não foi possível importar os fornecedores.");
    } finally {
      setImportando(false);
    }
  }

  return (
    <Modal open={aberto} onClose={fechar} title="Importar Lista de Fornecedores em Excel">
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
            {linhas.length} fornecedor(es) pronto(s) para importação.
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
            onClick={importarDados}
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
