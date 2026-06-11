"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, FolderOpen, X } from "lucide-react";
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
  const [pasta, setPasta] = useState("");
  const [arquivos, setArquivos] = useState<ArquivoBackup[]>([]);
  const [acessoLiberado, setAcessoLiberado] = useState(false);
  const [mensagemExplorer, setMensagemExplorer] = useState<string | null>(null);
  const [explorerAberto, setExplorerAberto] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSenha("");
    setErroInline(null);
    setPasta("");
    setArquivos([]);
    setAcessoLiberado(false);
    setMensagemExplorer(null);
    setExplorerAberto(false);
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
        aberto?: boolean;
        mensagem?: string | null;
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
      setExplorerAberto(Boolean(data.aberto));
      setMensagemExplorer(
        data.aberto
          ? null
          : data.mensagem || t("settings.backupAutoAbrirPastaSemExplorer")
      );
      onMensagem?.(
        data.aberto
          ? t("settings.backupAutoAbrirPastaSucesso")
          : t("settings.backupAutoAbrirPastaListaPronta"),
        data.aberto ? "sucesso" : "info"
      );
    } catch {
      const mensagemErro = t("settings.backupAutoAbrirPastaErro");
      setErroInline(mensagemErro);
      onMensagem?.(mensagemErro, "erro");
    } finally {
      setProcessando(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[96] flex items-center justify-center bg-black/50 p-4"
      onClick={() => !processando && onClose()}
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
            disabled={processando}
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
                <p>
                  {explorerAberto
                    ? t("settings.backupAutoAbrirPastaAcessoOkExplorer")
                    : t("settings.backupAutoAbrirPastaAcessoOk")}
                </p>
              </div>

              <div className="rounded border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-950">
                <span className="font-semibold">
                  {t("settings.backupAutoAbrirPastaCaminho")}:
                </span>{" "}
                <span className="break-all font-mono">{pasta}</span>
              </div>

              {mensagemExplorer ? (
                <p className="text-xs text-amber-800">{mensagemExplorer}</p>
              ) : null}

              <div>
                <p className="text-xs font-semibold text-slate-700">
                  {t("settings.backupAutoAbrirPastaArquivos")}
                </p>
                {arquivos.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    {t("settings.backupAutoAbrirPastaVazia")}
                  </p>
                ) : (
                  <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded border border-slate-200">
                    {arquivos.map((arquivo) => (
                      <li
                        key={arquivo.nome}
                        className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-xs last:border-b-0"
                      >
                        <span className="min-w-0 truncate font-medium text-slate-800">
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
            </div>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={processando}
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
