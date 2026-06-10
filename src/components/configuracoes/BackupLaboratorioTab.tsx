"use client";

import { useEffect, useState } from "react";
import { Clock, Download, Upload, AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui";
import { useI18n } from "@/components/i18n-provider";
import { RestaurarPadraoModal } from "@/components/configuracoes/RestaurarPadraoModal";
import { PalavraChaveRestaurarSection } from "@/components/configuracoes/PalavraChaveRestaurarSection";

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
  arquivoPadrao: string;
  arquivoExiste: boolean;
  ultimoBackupFormatado: string | null;
  proximoBackupFormatado: string | null;
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

const HORAS_BACKUP = Array.from({ length: 24 }, (_, indice) => indice);
const MINUTOS_BACKUP = Array.from({ length: 60 }, (_, indice) => indice);

const classeSelectHorario =
  "h-9 min-w-0 flex-1 rounded border border-emerald-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-emerald-500 disabled:bg-slate-50";

export function BackupLaboratorioTab({ onMensagem }: Props) {
  const { t } = useI18n();
  const [exportando, setExportando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [confirmarSubstituir, setConfirmarSubstituir] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [modalPadraoAberto, setModalPadraoAberto] = useState(false);
  const [ehProprietario, setEhProprietario] = useState(false);
  const [statusAuto, setStatusAuto] = useState<StatusBackupAutomatico | null>(null);
  const [carregandoAuto, setCarregandoAuto] = useState(false);
  const [salvandoAuto, setSalvandoAuto] = useState(false);
  const [autoAtivo, setAutoAtivo] = useState(true);
  const [autoDia, setAutoDia] = useState<string>("todos");
  const [autoHora, setAutoHora] = useState(0);
  const [autoMinuto, setAutoMinuto] = useState(0);

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
      setAutoHora(data.config.hora);
      setAutoMinuto(data.config.minuto);
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
        await carregarStatusAutomatico();
      }
    })();
  }, []);

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
          hora: autoHora,
          minuto: autoMinuto,
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

  async function exportar() {
    setExportando(true);
    try {
      const res = await fetch("/api/backup/export", { credentials: "same-origin" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        onMensagem?.(data.error || t("settings.backupErroExportar"), "erro");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const nome = match?.[1] || `backup-lab-protese-${new Date().toISOString().slice(0, 10)}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nome;
      a.click();
      URL.revokeObjectURL(url);
      onMensagem?.(t("settings.backupExportado"), "sucesso");
    } catch {
      onMensagem?.(t("settings.backupErroExportar"), "erro");
    } finally {
      setExportando(false);
    }
  }

  async function importar() {
    if (!arquivo) {
      onMensagem?.(t("settings.backupSelecioneArquivo"), "erro");
      return;
    }
    if (!confirmarSubstituir) {
      onMensagem?.(t("settings.backupConfirmeSubstituir"), "erro");
      return;
    }

    setImportando(true);
    try {
      const texto = await arquivo.text();
      const res = await fetch("/api/backup/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-backup-confirmar": "substituir-tudo",
        },
        credentials: "same-origin",
        body: texto,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onMensagem?.(data.error || t("settings.backupErroImportar"), "erro");
        return;
      }
      const total = Object.values(data.contagens || {}).reduce(
        (s: number, n) => s + (typeof n === "number" ? n : 0),
        0
      );
      onMensagem?.(
        t("settings.backupImportado").replace("{n}", String(total)),
        "sucesso"
      );
      setArquivo(null);
      setConfirmarSubstituir(false);
      window.setTimeout(() => {
        window.location.href = "/app";
      }, 2000);
    } catch {
      onMensagem?.(t("settings.backupErroImportar"), "erro");
    } finally {
      setImportando(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">
          {t("settings.backupTitulo")}
        </h2>
        <p className="mt-1 text-xs text-slate-600">{t("settings.backupDescricao")}</p>
      </div>

      {ehProprietario && (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-5">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="text-sm font-medium text-emerald-950">
                  {t("settings.backupAutoTitulo")}
                </h3>
                <p className="mt-1 text-xs text-emerald-900/90">
                  {t("settings.backupAutoDesc")}
                </p>
              </div>

              {carregandoAuto ? (
                <p className="text-xs text-emerald-800">{t("settings.backupAutoCarregando")}</p>
              ) : (
                <>
                  <div className="rounded border border-emerald-200 bg-white/90 px-3 py-3 text-xs text-emerald-950">
                    {statusAuto?.ultimoBackupFormatado ? (
                      <p>
                        <span className="font-semibold">{t("settings.backupAutoUltimoLabel")}</span>{" "}
                        {statusAuto.ultimoBackupFormatado}
                      </p>
                    ) : (
                      <p className="text-emerald-800">{t("settings.backupAutoUltimoNunca")}</p>
                    )}
                    <p className="mt-1.5">
                      <span className="font-semibold">{t("settings.backupAutoProximoLabel")}</span>{" "}
                      {statusAuto?.config.ativo && statusAuto.proximoBackupFormatado
                        ? statusAuto.proximoBackupFormatado
                        : t("settings.backupAutoProximoDesativado")}
                    </p>
                    {statusAuto?.arquivoPadrao && (
                      <p className="mt-1.5 text-[11px] text-emerald-800">
                        {t("settings.backupAutoArquivo").replace(
                          "{caminho}",
                          statusAuto.arquivoPadrao
                        )}
                        {statusAuto.arquivoExiste
                          ? ` (${t("settings.backupAutoArquivoOk")})`
                          : ` (${t("settings.backupAutoArquivoPendente")})`}
                      </p>
                    )}
                  </div>

                  <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-emerald-950">
                    <input
                      type="checkbox"
                      checked={autoAtivo}
                      onChange={(evento) => setAutoAtivo(evento.target.checked)}
                      className="h-3.5 w-3.5 accent-emerald-600"
                      disabled={salvandoAuto}
                    />
                    {t("settings.backupAutoAtivo")}
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-medium text-emerald-950">
                      {t("settings.backupAutoDia")}
                      <select
                        value={autoDia}
                        onChange={(evento) => setAutoDia(evento.target.value)}
                        disabled={salvandoAuto || !autoAtivo}
                        className="mt-1 h-9 w-full rounded border border-emerald-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-emerald-500 disabled:bg-slate-50"
                      >
                        <option value="todos">{t("settings.backupAutoDiaTodos")}</option>
                        {DIAS_SEMANA_KEYS.map((key, indice) => (
                          <option key={key} value={String(indice)}>
                            {t(key)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="block text-xs font-medium text-emerald-950">
                      {t("settings.backupAutoHorario")}
                      <div className="mt-1 flex items-center gap-1.5">
                        <select
                          value={autoHora}
                          onChange={(evento) => setAutoHora(Number(evento.target.value))}
                          disabled={salvandoAuto || !autoAtivo}
                          className={classeSelectHorario}
                          aria-label={t("settings.backupAutoHora")}
                        >
                          {HORAS_BACKUP.map((hora) => (
                            <option key={hora} value={hora}>
                              {String(hora).padStart(2, "0")}
                            </option>
                          ))}
                        </select>
                        <span className="text-sm font-semibold text-emerald-800">:</span>
                        <select
                          value={autoMinuto}
                          onChange={(evento) => setAutoMinuto(Number(evento.target.value))}
                          disabled={salvandoAuto || !autoAtivo}
                          className={classeSelectHorario}
                          aria-label={t("settings.backupAutoMinuto")}
                        >
                          {MINUTOS_BACKUP.map((minuto) => (
                            <option key={minuto} value={minuto}>
                              {String(minuto).padStart(2, "0")}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

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
                </>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-slate-50/80 p-5">
        <div className="flex items-start gap-3">
          <Download className="mt-0.5 h-5 w-5 shrink-0 text-[#4a90d9]" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-slate-800">
              {t("settings.backupExportarTitulo")}
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              {t("settings.backupExportarDesc")}
            </p>
            <Button
              type="button"
              disabled={exportando}
              onClick={() => void exportar()}
              className="mt-4 rounded bg-[#4a90d9] px-4 py-2 text-sm text-white hover:bg-[#3d7fc4]"
            >
              {exportando ? t("settings.backupExportando") : t("settings.backupBaixar")}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-amber-200 bg-amber-50/90 p-5">
        <div className="flex items-start gap-3">
          <Upload className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-amber-900">
              {t("settings.backupImportarTitulo")}
            </h3>
            <p className="mt-1 text-xs text-amber-900/90">
              {t("settings.backupImportarDesc")}
            </p>

            <div className="mt-4 flex items-start gap-2 rounded border border-amber-300 bg-white/80 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <p className="text-xs font-medium text-red-700">
                {t("settings.backupAvisoApagar")}
              </p>
            </div>

            <label className="mt-4 block text-xs font-medium text-slate-700">
              {t("settings.backupArquivo")}
              <input
                type="file"
                accept=".json,application/json"
                className="mt-1 block w-full text-xs text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-[#4a90d9] file:px-3 file:py-1.5 file:text-xs file:text-white"
                onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                disabled={importando}
              />
            </label>

            <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={confirmarSubstituir}
                onChange={(e) => setConfirmarSubstituir(e.target.checked)}
                className="mt-0.5"
                disabled={importando}
              />
              {t("settings.backupConfirmarCheckbox")}
            </label>

            <Button
              type="button"
              variant="outline"
              disabled={importando || !arquivo}
              onClick={() => void importar()}
              className="mt-4 rounded border-amber-600 bg-white px-4 py-2 text-sm text-amber-900 hover:bg-amber-100"
            >
              {importando ? t("settings.backupImportando") : t("settings.backupRestaurar")}
            </Button>
          </div>
        </div>
      </section>

      {ehProprietario ? (
        <>
          <PalavraChaveRestaurarSection onMensagem={onMensagem} />

          <section className="rounded-lg border border-red-200 bg-red-50/80 p-5">
            <div className="flex items-start gap-3">
              <RotateCcw className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-900">
                  {t("settings.restaurarPadraoSecaoTitulo")}
                </h3>
                <p className="mt-1 text-xs text-red-900/90">
                  {t("settings.restaurarPadraoSecaoDesc")}
                </p>
                <p className="mt-2 text-[11px] font-medium text-red-800">
                  {t("settings.restaurarPadraoSomenteProprietario")}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalPadraoAberto(true)}
                  className="mt-4 rounded border-red-600 bg-white px-4 py-2 text-sm text-red-800 hover:bg-red-100"
                >
                  {t("settings.restaurarPadraoBotao")}
                </Button>
              </div>
            </div>
          </section>
        </>
      ) : (
        <p className="text-xs text-slate-500">{t("settings.restaurarPadraoAcessoNegado")}</p>
      )}

      <RestaurarPadraoModal
        open={modalPadraoAberto}
        onClose={() => setModalPadraoAberto(false)}
        onMensagem={onMensagem}
      />
    </div>
  );
}
