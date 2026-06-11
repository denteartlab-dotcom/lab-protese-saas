"use client";

import { useCallback, useEffect, useState } from "react";
import { FolderOpen, X } from "lucide-react";
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
  const [palavraChave, setPalavraChave] = useState("");
  const [exigePalavraChave, setExigePalavraChave] = useState(false);
  const [referenciaPalavraChave, setReferenciaPalavraChave] = useState<string | null>(
    null
  );
  const [palavraChaveCadastrada, setPalavraChaveCadastrada] = useState(false);
  const [tentativasSenha, setTentativasSenha] = useState(0);
  const [processando, setProcessando] = useState(false);
  const [pasta, setPasta] = useState("");
  const [arquivos, setArquivos] = useState<ArquivoBackup[]>([]);
  const [acessoLiberado, setAcessoLiberado] = useState(false);
  const [mensagemExplorer, setMensagemExplorer] = useState<string | null>(null);

  const carregarSeguranca = useCallback(async () => {
    const res = await fetch("/api/backup/seguranca-restaurar", {
      credentials: "same-origin",
    });
    if (!res.ok) return;
    const data = (await res.json()) as {
      exigePalavraChave?: boolean;
      referencia?: string | null;
      palavraChaveCadastrada?: boolean;
      tentativasSenha?: number;
    };
    setExigePalavraChave(Boolean(data.exigePalavraChave));
    setReferenciaPalavraChave(data.referencia ?? null);
    setPalavraChaveCadastrada(Boolean(data.palavraChaveCadastrada));
    setTentativasSenha(data.tentativasSenha ?? 0);
  }, []);

  useEffect(() => {
    if (!open) return;
    setSenha("");
    setPalavraChave("");
    setPasta("");
    setArquivos([]);
    setAcessoLiberado(false);
    setMensagemExplorer(null);
    void carregarSeguranca();
  }, [open, carregarSeguranca]);

  async function abrirPasta() {
    setProcessando(true);
    try {
      const res = await fetch("/api/backup/abrir-pasta", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senha: exigePalavraChave ? undefined : senha,
          palavraChave: exigePalavraChave ? palavraChave : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        tentativasSenha?: number;
        exigePalavraChave?: boolean;
        palavraChaveCadastrada?: boolean;
        pasta?: string;
        arquivos?: ArquivoBackup[];
        aberto?: boolean;
        mensagem?: string | null;
      };

      if (!res.ok) {
        if (typeof data.tentativasSenha === "number") {
          setTentativasSenha(data.tentativasSenha);
        }
        if (typeof data.exigePalavraChave === "boolean") {
          setExigePalavraChave(data.exigePalavraChave);
        }
        if (typeof data.palavraChaveCadastrada === "boolean") {
          setPalavraChaveCadastrada(data.palavraChaveCadastrada);
        }
        onMensagem?.(data.error || t("settings.backupAutoAbrirPastaErro"), "erro");
        return;
      }

      setAcessoLiberado(true);
      setPasta(data.pasta || "");
      setArquivos(data.arquivos || []);
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
      onMensagem?.(t("settings.backupAutoAbrirPastaErro"), "erro");
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
                {t("settings.backupAutoAbrirPastaTitulo")}
              </h2>
              <p className="mt-1 text-xs text-emerald-900/90">
                {t("settings.backupAutoAbrirPastaDesc")}
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
            <>
              {exigePalavraChave ? (
                <div className="space-y-3 rounded border border-amber-300 bg-amber-50 p-3">
                  <p className="text-xs font-medium text-amber-900">
                    {t("settings.restaurarPadraoBloqueadoSenha")}
                  </p>
                  {referenciaPalavraChave ? (
                    <p className="text-[11px] text-amber-800">
                      {t("settings.restaurarPadraoReferenciaLembrete")}:{" "}
                      <strong>{referenciaPalavraChave}</strong>
                    </p>
                  ) : null}
                  <label className="block text-xs font-medium text-slate-700">
                    {t("settings.restaurarPadraoPalavraChaveCampo")}
                    <input
                      type="password"
                      value={palavraChave}
                      onChange={(evento) => setPalavraChave(evento.target.value)}
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      disabled={processando}
                      autoComplete="off"
                    />
                  </label>
                  {!palavraChaveCadastrada ? (
                    <p className="text-[11px] text-red-700">
                      {t("settings.restaurarPadraoCadastrePalavraChave")}
                    </p>
                  ) : null}
                </div>
              ) : (
                <label className="block text-xs font-medium text-slate-700">
                  {t("settings.restaurarPadraoSenhaProprietario")}
                  <input
                    type="password"
                    value={senha}
                    onChange={(evento) => setSenha(evento.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    disabled={processando}
                    autoComplete="current-password"
                  />
                  {tentativasSenha > 0 ? (
                    <span className="mt-1 block text-[11px] text-amber-700">
                      {t("settings.restaurarPadraoTentativasSenha").replace(
                        "{n}",
                        String(tentativasSenha)
                      )}
                    </span>
                  ) : null}
                </label>
              )}
            </>
          ) : (
            <div className="space-y-4">
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
                  <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded border border-slate-200">
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
              disabled={
                processando ||
                (exigePalavraChave ? !palavraChave.trim() : !senha.trim())
              }
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
