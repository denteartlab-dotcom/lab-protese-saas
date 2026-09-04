"use client";

import { useEffect, useState } from "react";
import { Clock, Download, Upload, AlertTriangle, RotateCcw, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui";
import { useI18n } from "@/components/i18n-provider";
import { ModalAbrirPastaBackup } from "@/components/configuracoes/ModalAbrirPastaBackup";
import { RestaurarPadraoModal } from "@/components/configuracoes/RestaurarPadraoModal";
import { PalavraChaveRestaurarSection } from "@/components/configuracoes/PalavraChaveRestaurarSection";
import type { ModuloLimpezaId } from "@/lib/limpar-modulos-laboratorio";
import {
  exportarBackupComJob,
  gerarBackupServidorComJob,
  importarBackupComJob,
  rotuloFaseBackup,
} from "@/lib/backup-job-cliente";

type Props = {
  onMensagem?: (texto: string, tipo?: "info" | "sucesso" | "erro") => void;
};

type StatusBackupAutomatico = {
  config: {
    ativo: boolean;
    diaSemana: number | null;
    hora: number;
    minuto: number;
    ultimoBackupEm: string | null;
    proximoBackupEm: string | null;
    ultimoArquivo: string | null;
  };
  servidorHabilitado: boolean;
  hospedagemVercel?: boolean;
  agendadorInternoAtivo?: boolean;
  pastaPadrao: string;
  pastaUploads?: string;
  uploadsArquivos?: number;
  onedriveSyncHabilitado?: boolean;
  uploadStorage?: "onedrive" | "database" | "disk";
  onedriveUploadsAtivo?: boolean;
  onedriveUploadsRemote?: string | null;
  onedriveGraphConfigurado?: boolean;
  onedriveFaltandoCredenciais?: string[];
  horarioFixo?: string;
  padraoNomeArquivo: string;
  arquivoPadrao: string;
  ultimoArquivoNome: string | null;
  arquivoExiste: boolean;
  fusoHorario?: string;
  ultimoBackupFormatado: string | null;
  proximoBackupFormatado: string | null;
  googleDrive?: {
    habilitado: boolean;
    configurado: boolean;
    pastaRaizId: string | null;
    pastaRaizNome?: string;
    retencaoDias: number | null;
    pastaEmpresa: string | null;
    caminhoEmpresa: string;
    statusUpload: {
      tipo: "ok" | "erro" | "pendente";
      mensagem: string;
      arquivo?: string | null;
      pastaEmpresa?: string | null;
    };
  };
};

const DIAS_SEMANA_KEYS = [
  "settings.backupAutoDiaDom",
  "settings.backupAutoDiaSeg",
  "settings.backupAutoDiaTer",
  "settings.backupAutoDiaQua",
  "settings.backupAutoDiaQui",
  "settings.backupAutoDiaSex",
  "settings.backupAutoDiaSab",
] as const;

export function BackupLaboratorioTab({ onMensagem }: Props) {
  const { t } = useI18n();
  const [exportando, setExportando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [confirmarSubstituir, setConfirmarSubstituir] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [modalPadraoAberto, setModalPadraoAberto] = useState(false);
  const [modalPadraoPreset, setModalPadraoPreset] = useState<
    ModuloLimpezaId[] | undefined
  >(undefined);
  const [ehProprietario, setEhProprietario] = useState(false);
  const [statusAuto, setStatusAuto] = useState<StatusBackupAutomatico | null>(null);
  const [carregandoAuto, setCarregandoAuto] = useState(false);
  const [salvandoAuto, setSalvandoAuto] = useState(false);
  const [gerandoBackupServidor, setGerandoBackupServidor] = useState(false);
  const [progressoOperacao, setProgressoOperacao] = useState("");
  const [autoAtivo, setAutoAtivo] = useState(true);
  const [autoDia, setAutoDia] = useState<string>("todos");
  const [modalPastaBackupAberto, setModalPastaBackupAberto] = useState(false);
  const [fonteImportacao, setFonteImportacao] = useState<"arquivo" | "pasta">("arquivo");
  const [arquivosPastaAutomatica, setArquivosPastaAutomatica] = useState<
    { nome: string; bytes: number; modificadoEm: string }[]
  >([]);
  const [carregandoArquivosPasta, setCarregandoArquivosPasta] = useState(false);
  const [arquivoPastaSelecionado, setArquivoPastaSelecionado] = useState("");

  async function carregarStatusAutomatico() {
    setCarregandoAuto(true);
    try {
      const res = await fetch("/api/backup/automatico", { credentials: "same-origin" });
      if (!res.ok) return;
      const data = (await res.json()) as StatusBackupAutomatico;
      setStatusAuto(data);
      setAutoAtivo(data.config.ativo);
      setAutoDia(
        data.config.diaSemana === null ? "todos" : String(data.config.diaSemana)
      );
    } finally {
      setCarregandoAuto(false);
    }
  }

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/backup/seguranca-restaurar", {
        credentials: "same-origin",
      });
      const proprietario = res.ok;
      setEhProprietario(proprietario);
      if (proprietario) {
        await Promise.all([carregarStatusAutomatico(), carregarArquivosPastaAutomatica()]);
      }
    })();
  }, []);

  async function carregarArquivosPastaAutomatica() {
    setCarregandoArquivosPasta(true);
    try {
      const res = await fetch("/api/backup/arquivos-automaticos", {
        credentials: "same-origin",
      });
      if (!res.ok) {
        setArquivosPastaAutomatica([]);
        return;
      }
      const data = (await res.json()) as {
        arquivos?: { nome: string; bytes: number; modificadoEm: string }[];
      };
      const lista = data.arquivos || [];
      setArquivosPastaAutomatica(lista);
      setArquivoPastaSelecionado((atual) =>
        atual && lista.some((a) => a.nome === atual) ? atual : lista[0]?.nome || ""
      );
    } finally {
      setCarregandoArquivosPasta(false);
    }
  }

  async function salvarAgendamentoAutomatico() {
    setSalvandoAuto(true);
    try {
      const res = await fetch("/api/backup/automatico", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ativo: autoAtivo,
          diaSemana: autoDia === "todos" ? null : Number(autoDia),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onMensagem?.(data.error || t("settings.backupAutoErro"), "erro");
        return;
      }
      setStatusAuto(data as StatusBackupAutomatico);
      onMensagem?.(t("settings.backupAutoSalvo"), "sucesso");
    } catch {
      onMensagem?.(t("settings.backupAutoErro"), "erro");
    } finally {
      setSalvandoAuto(false);
    }
  }

  async function gerarBackupServidorAgora() {
    setGerandoBackupServidor(true);
    setProgressoOperacao("");
    try {
      const resultado = await gerarBackupServidorComJob({
        onFase: (fase, percentual) =>
          setProgressoOperacao(`${rotuloFaseBackup(fase)} (${percentual}%)`),
      });
      await Promise.all([carregarStatusAutomatico(), carregarArquivosPastaAutomatica()]);
      const uploads = resultado.uploadsArquivos ?? 0;
      const onedrive = resultado.onedrive;
      if (onedrive && onedrive.ok === false && onedrive.erro && onedrive.erro !== "desativado") {
        onMensagem?.(
          `${t("settings.backupServidorOk").replace("{n}", String(uploads))} ${t(
            "settings.backupServidorOneDriveErro"
          )}`,
          "erro"
        );
      } else {
        onMensagem?.(
          t("settings.backupServidorOk").replace("{n}", String(uploads)),
          "sucesso"
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("settings.backupServidorErro");
      onMensagem?.(msg, "erro");
    } finally {
      setGerandoBackupServidor(false);
      setProgressoOperacao("");
    }
  }

  async function exportar() {
    setExportando(true);
    setProgressoOperacao("");
    try {
      await exportarBackupComJob({
        onFase: (fase, percentual) =>
          setProgressoOperacao(`${rotuloFaseBackup(fase)} (${percentual}%)`),
      });
      onMensagem?.(t("settings.backupExportado"), "sucesso");
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("settings.backupErroExportar");
      onMensagem?.(msg, "erro");
    } finally {
      setExportando(false);
      setProgressoOperacao("");
    }
  }

  async function importar() {
    if (fonteImportacao === "arquivo" && !arquivo) {
      onMensagem?.(t("settings.backupSelecioneArquivo"), "erro");
      return;
    }
    if (fonteImportacao === "pasta" && !arquivoPastaSelecionado) {
      onMensagem?.(t("settings.backupSelecioneArquivoPasta"), "erro");
      return;
    }
    if (!confirmarSubstituir) {
      onMensagem?.(t("settings.backupConfirmeSubstituir"), "erro");
      return;
    }

    setImportando(true);
    setProgressoOperacao("");
    try {
      const headers: Record<string, string> = {
        "x-backup-confirmar": "substituir-tudo",
      };

      let resultado;
      if (fonteImportacao === "pasta") {
        const res = await fetch("/api/backup/import-pasta", {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            arquivo: arquivoPastaSelecionado,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          onMensagem?.(data.error || t("settings.backupErroImportar"), "erro");
          return;
        }
        resultado = data;
      } else {
        const formData = new FormData();
        formData.append("arquivo", arquivo!);
        resultado = await importarBackupComJob(
          { headers, body: formData },
          {
            onFase: (fase, percentual) =>
              setProgressoOperacao(`${rotuloFaseBackup(fase)} (${percentual}%)`),
          }
        );
      }

      const total = Object.values(resultado.contagens || {}).reduce(
        (s: number, n) => s + (typeof n === "number" ? n : 0),
        0
      );
      onMensagem?.(
        t("settings.backupImportado")
          .replace("{n}", String(total))
          .replace("{u}", String(resultado.uploadsRestaurados ?? 0)),
        "sucesso"
      );
      setArquivo(null);
      setConfirmarSubstituir(false);
      if (fonteImportacao === "pasta") {
        void carregarArquivosPastaAutomatica();
      }
      window.setTimeout(() => {
        window.location.href = "/app";
      }, 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("settings.backupErroImportar");
      onMensagem?.(msg, "erro");
    } finally {
      setImportando(false);
      setProgressoOperacao("");
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {t("settings.backupTitulo")}
        </h2>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{t("settings.backupDescricao")}</p>
      </div>

      {ehProprietario && (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-5 dark:border-emerald-800 dark:bg-emerald-950/35">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="text-sm font-medium text-emerald-950 dark:text-emerald-100">
                  {t("settings.backupAutoTitulo")}
                </h3>
              </div>

              {carregandoAuto ? (
                <p className="text-xs text-emerald-800 dark:text-emerald-300">{t("settings.backupAutoCarregando")}</p>
              ) : (
                <>
                  <div className="rounded border border-emerald-200 bg-white/90 px-3 py-3 text-xs text-emerald-950 dark:border-emerald-800 dark:bg-slate-900/70 dark:text-emerald-100">
                    {statusAuto?.ultimoBackupFormatado ? (
                      <p>
                        <span className="font-semibold">{t("settings.backupAutoUltimoLabel")}</span>{" "}
                        {statusAuto.ultimoBackupFormatado}
                      </p>
                    ) : (
                      <p className="text-emerald-800 dark:text-emerald-300">{t("settings.backupAutoUltimoNunca")}</p>
                    )}
                    <p className="mt-1.5">
                      <span className="font-semibold">{t("settings.backupAutoProximoLabel")}</span>{" "}
                      {!statusAuto?.config.ativo
                        ? t("settings.backupAutoProximoDesativado")
                        : statusAuto.proximoBackupFormatado ||
                          t("settings.backupAutoProximoPendente")}
                    </p>
                  </div>

                  <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-emerald-950 dark:text-emerald-100">
                    <input
                      type="checkbox"
                      checked={autoAtivo}
                      onChange={(evento) => setAutoAtivo(evento.target.checked)}
                      className="h-3.5 w-3.5 accent-emerald-600"
                      disabled={salvandoAuto}
                    />
                    {t("settings.backupAutoAtivo")}
                  </label>

                  <div className="grid gap-3 sm:max-w-xs">
                    <label className="block text-xs font-medium text-emerald-950 dark:text-emerald-100">
                      {t("settings.backupAutoDia")}
                      <select
                        value={autoDia}
                        onChange={(evento) => setAutoDia(evento.target.value)}
                        disabled={salvandoAuto || !autoAtivo}
                        className="mt-1 h-9 w-full rounded border border-emerald-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-emerald-500 disabled:bg-slate-50 dark:border-emerald-700 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800"
                      >
                        <option value="todos">{t("settings.backupAutoDiaTodos")}</option>
                        {DIAS_SEMANA_KEYS.map((key, indice) => (
                          <option key={key} value={String(indice)}>
                            {t(key)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <p className="text-[11px] text-emerald-900/90 dark:text-emerald-200/90">
                      {t("settings.backupAutoHorarioFixo").replace(
                        "{horario}",
                        statusAuto?.horarioFixo ?? "23:30"
                      )}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      disabled={salvandoAuto}
                      onClick={() => void salvarAgendamentoAutomatico()}
                      className="rounded bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {salvandoAuto
                        ? t("settings.backupAutoSalvando")
                        : t("settings.backupAutoSalvar")}
                    </Button>
                    {!statusAuto?.hospedagemVercel ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={gerandoBackupServidor || salvandoAuto}
                        onClick={() => void gerarBackupServidorAgora()}
                        className="inline-flex items-center gap-2 rounded border-emerald-500 bg-white px-4 py-2 text-sm text-emerald-900 hover:bg-emerald-50 dark:border-emerald-600 dark:bg-slate-800 dark:text-emerald-200 dark:hover:bg-emerald-950/50"
                      >
                        {gerandoBackupServidor
                          ? t("settings.backupServidorGerando")
                          : t("settings.backupServidorGerarAgora")}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      disabled={salvandoAuto}
                      onClick={() => setModalPastaBackupAberto(true)}
                      className="inline-flex items-center gap-2 rounded border-emerald-300 bg-white px-4 py-2 text-sm text-emerald-900 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-slate-800 dark:text-emerald-200 dark:hover:bg-emerald-950/50"
                    >
                      <FolderOpen className="h-4 w-4" />
                      {t("settings.backupAutoAbrirPasta")}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-700 dark:bg-slate-900/50">
        <div className="flex items-start gap-3">
          <Download className="mt-0.5 h-5 w-5 shrink-0 text-[#4a90d9]" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-slate-800 dark:text-slate-100">
              {t("settings.backupExportarTitulo")}
            </h3>
            <Button
              type="button"
              disabled={exportando}
              onClick={() => void exportar()}
              className="mt-4 rounded bg-[#4a90d9] px-4 py-2 text-sm text-white hover:bg-[#3d7fc4]"
            >
              {exportando
                ? progressoOperacao || t("settings.backupExportando")
                : t("settings.backupBaixar")}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-amber-200 bg-amber-50/90 p-5 dark:border-amber-800 dark:bg-amber-950/35">
        <div className="flex items-start gap-3">
          <Upload className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-amber-900 dark:text-amber-100">
              {t("settings.backupImportarTitulo")}
            </h3>

            <div className="mt-4 flex items-start gap-2 rounded border border-amber-300 bg-white/80 p-3 dark:border-amber-700 dark:bg-slate-900/60">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              <p className="text-xs font-medium text-red-700 dark:text-red-300">
                {t("settings.backupAvisoApagar")}
              </p>
            </div>

            <fieldset className="mt-4 rounded-lg border border-amber-200 bg-white/70 p-4 dark:border-amber-800 dark:bg-slate-900/50">
              <legend className="px-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
                {t("settings.backupFonteImportacao")}
              </legend>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="fonte-importacao-backup"
                    checked={fonteImportacao === "arquivo"}
                    onChange={() => setFonteImportacao("arquivo")}
                    disabled={importando}
                  />
                  {t("settings.backupFonteArquivo")}
                </label>
                {ehProprietario ? (
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="fonte-importacao-backup"
                      checked={fonteImportacao === "pasta"}
                      onChange={() => setFonteImportacao("pasta")}
                      disabled={importando}
                    />
                    {t("settings.backupFontePastaAutomatica")}
                  </label>
                ) : null}
              </div>
            </fieldset>

            {fonteImportacao === "arquivo" ? (
              <label className="mt-4 block text-xs font-medium text-slate-700 dark:text-slate-300">
                {t("settings.backupArquivo")}
                <input
                  type="file"
                  accept=".zip,.json,application/zip,application/json"
                  className="mt-1 block w-full text-xs text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-[#4a90d9] file:px-3 file:py-1.5 file:text-xs file:text-white dark:text-slate-300"
                  onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                  disabled={importando}
                />
              </label>
            ) : (
              <div className="mt-4 space-y-2 rounded-lg border border-amber-200 bg-white/70 p-4 dark:border-amber-800 dark:bg-slate-900/50">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {t("settings.backupArquivoPastaAutomatica")}
                  <select
                    value={arquivoPastaSelecionado}
                    onChange={(e) => setArquivoPastaSelecionado(e.target.value)}
                    disabled={importando || carregandoArquivosPasta}
                    className="mt-1 h-9 w-full rounded border border-amber-300 bg-white px-2 text-xs text-slate-700 outline-none focus:border-amber-500 dark:border-amber-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {carregandoArquivosPasta ? (
                      <option value="">{t("settings.backupAutoCarregando")}</option>
                    ) : arquivosPastaAutomatica.length === 0 ? (
                      <option value="">{t("settings.backupAutoAbrirPastaVazia")}</option>
                    ) : (
                      arquivosPastaAutomatica.map((item) => (
                        <option key={item.nome} value={item.nome}>
                          {item.nome}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <p className="text-[11px] leading-relaxed text-amber-900/90 dark:text-amber-200/90">
                  {t("settings.backupFontePastaAutomaticaDesc")}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={importando || carregandoArquivosPasta}
                  onClick={() => void carregarArquivosPastaAutomatica()}
                  className="rounded border-amber-400 bg-white px-3 py-1.5 text-xs text-amber-900 hover:bg-amber-100 dark:border-amber-600 dark:bg-slate-800 dark:text-amber-200 dark:hover:bg-amber-950/50"
                >
                  {t("settings.backupSincronizarPasta")}
                </Button>
              </div>
            )}

            <div className="mt-4 space-y-3 rounded-lg border border-amber-200/80 bg-white/60 p-4 dark:border-amber-800 dark:bg-slate-900/40">
              <label className="flex cursor-pointer items-start gap-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={confirmarSubstituir}
                  onChange={(e) => setConfirmarSubstituir(e.target.checked)}
                  className="mt-0.5"
                  disabled={importando}
                />
                <span>{t("settings.backupConfirmarCheckbox")}</span>
              </label>
            </div>

            <Button
              type="button"
              variant="outline"
              disabled={
                importando ||
                !confirmarSubstituir ||
                (fonteImportacao === "arquivo" ? !arquivo : !arquivoPastaSelecionado)
              }
              onClick={() => void importar()}
              className="mt-4 rounded border-amber-600 bg-white px-4 py-2 text-sm text-amber-900 hover:bg-amber-100 dark:border-amber-500 dark:bg-slate-800 dark:text-amber-200 dark:hover:bg-amber-950/50"
            >
              {importando ? t("settings.backupImportando") : t("settings.backupRestaurar")}
            </Button>
          </div>
        </div>
      </section>

      {ehProprietario ? (
        <>
          <PalavraChaveRestaurarSection onMensagem={onMensagem} />

          <section className="rounded-lg border border-red-200 bg-red-50/80 p-5 dark:border-red-900 dark:bg-red-950/35">
            <div className="flex items-start gap-3">
              <RotateCcw className="mt-0.5 h-5 w-5 shrink-0 text-red-700 dark:text-red-400" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-900 dark:text-red-100">
                  {t("settings.restaurarPadraoSecaoTitulo")}
                </h3>
                <p className="mt-1 text-xs text-red-900/90 dark:text-red-200/90">
                  {t("settings.restaurarPadraoSecaoDesc")}
                </p>
                <p className="mt-2 text-[11px] font-medium text-red-800 dark:text-red-300">
                  {t("settings.restaurarPadraoSomenteProprietario")}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setModalPadraoPreset(undefined);
                      setModalPadraoAberto(true);
                    }}
                    className="rounded border-red-600 bg-white px-4 py-2 text-sm text-red-800 hover:bg-red-100 dark:border-red-700 dark:bg-slate-800 dark:text-red-200 dark:hover:bg-red-950/50"
                  >
                    {t("settings.restaurarPadraoBotao")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setModalPadraoPreset(["conta_bancaria"]);
                      setModalPadraoAberto(true);
                    }}
                    className="rounded border-red-500 bg-white px-4 py-2 text-sm text-red-700 hover:bg-red-50 dark:border-red-800 dark:bg-slate-800 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    {t("settings.restaurarPadraoBotaoContaBancaria")}
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">{t("settings.restaurarPadraoAcessoNegado")}</p>
      )}

      <ModalAbrirPastaBackup
        open={modalPastaBackupAberto}
        onClose={() => setModalPastaBackupAberto(false)}
        onMensagem={onMensagem}
      />

      <RestaurarPadraoModal
        open={modalPadraoAberto}
        onClose={() => {
          setModalPadraoAberto(false);
          setModalPadraoPreset(undefined);
        }}
        onMensagem={onMensagem}
        modulosPreset={modalPadraoPreset}
      />
    </div>
  );
}
