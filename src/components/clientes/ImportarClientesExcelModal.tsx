"use client";

import { useI18n } from "@/components/i18n-provider";
import { I18nPortal } from "@/components/I18nPortal";
import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui";
import {
  clienteImportacaoParaPayload,
  parsearArquivoClientesExcel,
  type ClienteImportacaoLinha,
} from "@/lib/clientes-lista-export";
import { ErroJobCliente, importarClientesComJob } from "@/lib/clientes-import-cliente";

type Props = {
  aberto: boolean;
  onFechar: () => void;
  onImportado: () => void;
};

export function ImportarClientesExcelModal({ aberto, onFechar, onImportado }: Props) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [linhas, setLinhas] = useState<ClienteImportacaoLinha[]>([]);
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
      const parsed = await parsearArquivoClientesExcel(file);
      if (!parsed.length) {
        setLinhas([]);
        setErro(t("cadastros.clientes.importar.erroSemValidos"));
        return;
      }
      setLinhas(parsed);
    } catch {
      setLinhas([]);
      setErro(t("cadastros.clientes.importar.erroLerArquivo"));
    }
  }

  function mensagemErroImportacao(erroImport: unknown): string {
    if (erroImport instanceof ErroJobCliente) return erroImport.message;
    return t("cadastros.clientes.importar.erroConexao");
  }

  async function importarDados() {
    if (!linhas.length) {
      setErro(t("cadastros.clientes.importar.erroSelecioneArquivo"));
      return;
    }

    setImportando(true);
    setErro("");
    setProgresso(0);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resultado = await importarClientesComJob(
        linhas.map(clienteImportacaoParaPayload),
        {
          signal: controller.signal,
          onProgresso: (pct) => setProgresso(pct),
        }
      );

      const total = resultado.ok ?? resultado.importados ?? 0;
      const ignorados = resultado.ignorados ?? 0;
      const avisos = (resultado.erros ?? [])
        .slice(0, 3)
        .map((e) => `Linha ${e.linha}: ${e.mensagem}`)
        .join("\n");

      if (ignorados > 0) {
        alert(
          t("cadastros.clientes.importar.sucessoComIgnorados", {
            total,
            ignorados,
          }) + (avisos ? `\n\n${avisos}` : "")
        );
      } else {
        alert(t("cadastros.clientes.importar.sucesso", { n: total }));
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
      ? t("cadastros.clientes.importar.importandoPct", { pct: progresso })
      : importando
        ? t("cadastros.clientes.importar.importando")
        : t("cadastros.clientes.importar.botaoImportar");

  return (
    <Modal open={aberto} onClose={fechar} title={t("cadastros.clientes.importar.titulo")}>
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
            placeholder={t("cadastros.clientes.importar.placeholderArquivo")}
            className="h-[34px] min-w-0 flex-1 border-0 bg-white px-3 text-[12px] text-[#374151] outline-none placeholder:text-[#9ca3af] disabled:opacity-60"
            onClick={() => !importando && inputRef.current?.click()}
          />
          <button
            type="button"
            disabled={importando}
            onClick={() => inputRef.current?.click()}
            className="shrink-0 border-l border-[#d1d5db] bg-white px-4 text-[12px] font-normal text-[#374151] hover:bg-[#f9fafb] disabled:opacity-60"
          >
            {t("cadastros.clientes.importar.botaoArquivo")}
          </button>
        </div>

        {linhas.length > 0 ? (
          <p className="text-[12px] text-[#16a34a]">
            {t("cadastros.clientes.importar.prontos", { n: linhas.length })}
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
              {t("cadastros.clientes.importar.processando")}
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
            {t("cadastros.comum.cancelar")}
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
