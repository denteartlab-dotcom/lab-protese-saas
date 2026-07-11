"use client";

import { I18nPortal } from "@/components/I18nPortal";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, FolderOpen, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui";
import { useI18n } from "@/components/i18n-provider";
import { formatarTamanhoArmazenamento } from "@/lib/uploads-armazenamento";

type ArquivoBackup = {
  nome: string;
  bytes: number;
  modificadoEm: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onMensagem?: (texto: string, tipo?: "info" | "sucesso" | "erro") => void;
};

export function ModalAbrirPastaBackup({ open, onClose, onMensagem }: Props) {
  const { t } = useI18n();
  const [senha, setSenha] = useState("");
  const [erroInline, setErroInline] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [baixando, setBaixando] = useState<string | null>(null);
  const [pasta, setPasta] = useState("");
  const [arquivos, setArquivos] = useState<ArquivoBackup[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [acessoLiberado, setAcessoLiberado] = useState(false);

  const todosSelecionados = useMemo(
    () => arquivos.length > 0 && selecionados.size === arquivos.length,
    [arquivos.length, selecionados.size]
  );

  useEffect(() => {
    if (!open) return;
    setSenha("");
    setErroInline(null);
    setPasta("");
    setArquivos([]);
    setSelecionados(new Set());
    setAcessoLiberado(false);
    setExcluindo(false);
    setBaixando(null);
  }, [open]);

  async function abrirPasta() {
    const senhaInformada = senha.trim();
    if (!senhaInformada) {
      setErroInline(t("settings.backupAutoAbrirPastaInformeSenha"));
      return;
    }

    setProcessando(true);
    setErroInline(null);
    try {
      const res = await fetch("/api/backup/abrir-pasta", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha: senhaInformada }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        pasta?: string;
        arquivos?: ArquivoBackup[];
      };

      if (!res.ok) {
        const mensagemErro = data.error || t("settings.backupAutoAbrirPastaErro");
        setErroInline(mensagemErro);
        onMensagem?.(mensagemErro, "erro");
        return;
      }

      setAcessoLiberado(true);
      setPasta(data.pasta || "");
      setArquivos(data.arquivos || []);
      setSelecionados(new Set());
      onMensagem?.(t("settings.backupAutoAbrirPastaListaPronta"), "sucesso");
    } catch {
      const mensagemErro = t("settings.backupAutoAbrirPastaErro");
      setErroInline(mensagemErro);
      onMensagem?.(mensagemErro, "erro");
    } finally {
      setProcessando(false);
    }
  }

  async function baixarArquivo(nome: string) {
    setBaixando(nome);
    setErroInline(null);
    try {
      const res = await fetch(
        `/api/backup/baixar-arquivo?arquivo=${encodeURIComponent(nome)}`,
        { credentials: "same-origin" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error || t("settings.backupAutoBaixarArquivoErro")
        );
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nome;
      a.click();
      URL.revokeObjectURL(url);
      onMensagem?.(
        t("settings.backupAutoBaixarArquivoSucesso").replace("{nome}", nome),
        "sucesso"
      );
    } catch (erro) {
      const mensagemErro =
        erro instanceof Error ? erro.message : t("settings.backupAutoBaixarArquivoErro");
      setErroInline(mensagemErro);
      onMensagem?.(mensagemErro, "erro");
    } finally {
      setBaixando(null);
    }
  }

  function alternarSelecao(nome: string) {
    setSelecionados((atual) => {
      const next = new Set(atual);
      if (next.has(nome)) next.delete(nome);
      else next.add(nome);
      return next;
    });
  }

  function alternarTodos() {
    if (todosSelecionados) {
      setSelecionados(new Set());
      return;
    }
    setSelecionados(new Set(arquivos.map((a) => a.nome)));
  }

  async function excluirArquivos(nomes: string[]) {
    const senhaInformada = senha.trim();
    if (!senhaInformada) {
      setErroInline(t("settings.backupAutoAbrirPastaInformeSenha"));
      return;
    }
    if (nomes.length === 0) return;

    setExcluindo(true);
    setErroInline(null);
    try {
      const res = await fetch("/api/backup/excluir-arquivos", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha: senhaInformada, arquivos: nomes }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        excluidos?: string[];
        arquivos?: ArquivoBackup[];
      };

      if (!res.ok) {
        const mensagemErro =
          data.error || t("settings.backupAutoExcluirArquivoErro");
        setErroInline(mensagemErro);
        onMensagem?.(mensagemErro, "erro");
        return;
      }

      setArquivos(data.arquivos || []);
      setSelecionados(new Set());
      const qtd = data.excluidos?.length ?? nomes.length;
      onMensagem?.(
        t("settings.backupAutoExcluirArquivoSucesso").replace("{n}", String(qtd)),
        "sucesso"
      );
    } catch {
      const mensagemErro = t("settings.backupAutoExcluirArquivoErro");
      setErroInline(mensagemErro);
      onMensagem?.(mensagemErro, "erro");
    } finally {
      setExcluindo(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[96] flex items-center justify-center bg-black/50 p-4"
      onClick={() => !processando && !excluindo && !baixando && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="abrir-pasta-backup-titulo"
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="shrink-0 border-b border-emerald-200 bg-emerald-50 px-5 py-4">
          <div className="flex items-start gap-3 pr-8">
            <FolderOpen className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
            <div>
              <h2
                id="abrir-pasta-backup-titulo"
                className="text-base font-semibold text-emerald-950"
              >
                {acessoLiberado
                  ? t("settings.backupAutoAbrirPastaTituloConteudo")
                  : t("settings.backupAutoAbrirPastaTitulo")}
              </h2>
              <p className="mt-1 text-xs text-emerald-900/90">
                {acessoLiberado
                  ? t("settings.backupAutoAbrirPastaDescConteudo")
                  : t("settings.backupAutoAbrirPastaDesc")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={processando || excluindo || Boolean(baixando)}
            className="absolute right-3 top-3 rounded p-1 text-slate-500 hover:bg-emerald-100 disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {!acessoLiberado ? (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-slate-700">
                {t("settings.backupAutoAbrirPastaSenhaLogin")}
                <input
                  type="password"
                  value={senha}
                  onChange={(evento) => {
                    setSenha(evento.target.value);
                    if (erroInline) setErroInline(null);
                  }}
                  onKeyDown={(evento) => {
                    if (evento.key === "Enter") {
                      evento.preventDefault();
                      void abrirPasta();
                    }
                  }}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  disabled={processando}
                  autoComplete="current-password"
                />
              </label>
              <p className="text-[11px] text-slate-500">
                {t("settings.backupAutoAbrirPastaSenhaDica")}
              </p>
              {erroInline ? (
                <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {erroInline}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <p>{t("settings.backupAutoAbrirPastaAcessoOk")}</p>
              </div>

              <div className="rounded border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-950">
                <span className="font-semibold">
                  {t("settings.backupAutoAbrirPastaCaminho")}:
                </span>{" "}
                <span className="break-all font-mono">{pasta}</span>
              </div>

              <p className="text-[11px] text-slate-500">
                {t("settings.backupAutoAbrirPastaAvisoModal")}
              </p>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-700">
                    {t("settings.backupAutoAbrirPastaArquivos")}
                  </p>
                  {arquivos.length > 0 ? (
                    <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-600">
                      <input
                        type="checkbox"
                        checked={todosSelecionados}
                        onChange={alternarTodos}
                        disabled={excluindo || Boolean(baixando)}
                        className="h-3.5 w-3.5 accent-emerald-600"
                      />
                      {t("settings.backupAutoSelecionarTodosArquivos")}
                    </label>
                  ) : null}
                </div>
                {arquivos.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    {t("settings.backupAutoAbrirPastaVazia")}
                  </p>
                ) : (
                  <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded border border-slate-200">
                    {arquivos.map((arquivo) => (
                      <li
                        key={arquivo.nome}
                        className="flex items-center gap-1.5 border-b border-slate-100 px-2 py-2 text-xs last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={selecionados.has(arquivo.nome)}
                          onChange={() => alternarSelecao(arquivo.nome)}
                          disabled={excluindo || Boolean(baixando)}
                          className="h-3.5 w-3.5 shrink-0 accent-emerald-600"
                          aria-label={arquivo.nome}
                        />
                        <button
                          type="button"
                          onClick={() => void baixarArquivo(arquivo.nome)}
                          disabled={excluindo || baixando === arquivo.nome}
                          className="shrink-0 rounded p-1 text-[#4a90d9] hover:bg-blue-50 hover:text-[#3d7fc4] disabled:opacity-50"
                          title={t("settings.backupAutoBaixarArquivo")}
                          aria-label={t("settings.backupAutoBaixarArquivo")}
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void excluirArquivos([arquivo.nome])}
                          disabled={excluindo || Boolean(baixando)}
                          className="shrink-0 rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                          title={t("settings.backupAutoRemoverArquivo")}
                          aria-label={t("settings.backupAutoRemoverArquivo")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <span className="min-w-0 flex-1 truncate font-medium text-slate-800">
                          {arquivo.nome}
                        </span>
                        <span className="shrink-0 text-slate-500">
                          {formatarTamanhoArmazenamento(arquivo.bytes)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {erroInline ? (
                <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {erroInline}
                </p>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4">
          {acessoLiberado && selecionados.size > 0 ? (
            <Button
              type="button"
              variant="outline"
              disabled={excluindo || Boolean(baixando)}
              onClick={() => void excluirArquivos([...selecionados])}
              className="mr-auto inline-flex items-center gap-2 rounded border-red-300 text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              {excluindo
                ? t("settings.backupAutoExcluindoArquivos")
                : t("settings.backupAutoExcluirSelecionados").replace(
                    "{n}",
                    String(selecionados.size)
                  )}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={processando || excluindo || Boolean(baixando)}
          >
            {t("common.cancelar")}
          </Button>
          {!acessoLiberado ? (
            <Button
              type="button"
              disabled={processando || !senha.trim()}
              onClick={() => void abrirPasta()}
              className="rounded bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {processando
                ? t("settings.backupAutoAbrirPastaAbrindo")
                : t("settings.backupAutoAbrirPastaConfirmar")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
