"use client";

import { useState } from "react";
import { Download, Upload, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui";
import { useI18n } from "@/components/i18n-provider";

type Props = {
  onMensagem?: (texto: string, tipo?: "info" | "sucesso" | "erro") => void;
};

export function BackupLaboratorioTab({ onMensagem }: Props) {
  const { t } = useI18n();
  const [exportando, setExportando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [confirmarSubstituir, setConfirmarSubstituir] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);

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
    </div>
  );
}
