"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui";
import { useI18n } from "@/components/i18n-provider";

type Props = {
  onMensagem?: (texto: string, tipo?: "info" | "sucesso" | "erro") => void;
};

type EstadoPalavraChave = {
  cadastrada: boolean;
  referencia: string | null;
};

export function PalavraChaveRestaurarSection({ onMensagem }: Props) {
  const { t } = useI18n();
  const [estado, setEstado] = useState<EstadoPalavraChave | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [formAberto, setFormAberto] = useState(false);
  const [palavraChave, setPalavraChave] = useState("");
  const [palavraChaveAtual, setPalavraChaveAtual] = useState("");
  const [referencia, setReferencia] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch("/api/backup/palavra-chave", {
        credentials: "same-origin",
      });
      if (res.status === 403) {
        setEstado(null);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        cadastrada?: boolean;
        referencia?: string | null;
      };
      if (!res.ok) return;
      setEstado({
        cadastrada: Boolean(data.cadastrada),
        referencia: data.referencia ?? null,
      });
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function salvar() {
    setSalvando(true);
    try {
      const res = await fetch("/api/backup/palavra-chave", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          palavraChave,
          referencia,
          ...(estado?.cadastrada ? { palavraChaveAtual } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        onMensagem?.(data.error || t("settings.palavraChaveErroSalvar"), "erro");
        return;
      }
      onMensagem?.(t("settings.palavraChaveSalva"), "sucesso");
      setPalavraChave("");
      setPalavraChaveAtual("");
      setReferencia("");
      setFormAberto(false);
      await carregar();
    } catch {
      onMensagem?.(t("settings.palavraChaveErroSalvar"), "erro");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando || estado === null) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50/80 p-5">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-slate-800">
            {t("settings.palavraChaveTitulo")}
          </h3>
          <p className="mt-1 text-xs text-slate-600">{t("settings.palavraChaveDesc")}</p>

          {estado.cadastrada && !formAberto ? (
            <div className="mt-3 rounded border border-slate-200 bg-white p-3 text-xs text-slate-700">
              <p>
                <span className="font-medium">{t("settings.palavraChaveReferencia")}:</span>{" "}
                {estado.referencia || "—"}
              </p>
              <p className="mt-1 text-slate-500">{t("settings.palavraChaveJaCadastrada")}</p>
            </div>
          ) : null}

          {formAberto ? (
            <div className="mt-4 space-y-3">
              {estado.cadastrada ? (
                <label className="block text-xs font-medium text-slate-700">
                  {t("settings.palavraChaveAtual")}
                  <input
                    type="password"
                    value={palavraChaveAtual}
                    onChange={(e) => setPalavraChaveAtual(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    autoComplete="off"
                  />
                </label>
              ) : null}
              <label className="block text-xs font-medium text-slate-700">
                {estado.cadastrada
                  ? t("settings.palavraChaveNova")
                  : t("settings.palavraChaveCampo")}
                <input
                  type="password"
                  value={palavraChave}
                  onChange={(e) => setPalavraChave(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  autoComplete="new-password"
                />
              </label>
              <label className="block text-xs font-medium text-slate-700">
                {t("settings.palavraChaveReferenciaCampo")}
                <input
                  type="text"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  placeholder={t("settings.palavraChaveReferenciaPlaceholder")}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <p className="text-[11px] text-slate-500">
                {t("settings.palavraChaveReferenciaAjuda")}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  disabled={salvando}
                  onClick={() => void salvar()}
                  className="rounded bg-[#4a90d9] px-4 py-2 text-sm text-white"
                >
                  {salvando ? t("common.gravando") : t("common.gravar")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={salvando}
                  onClick={() => {
                    setFormAberto(false);
                    setPalavraChave("");
                    setPalavraChaveAtual("");
                    setReferencia("");
                  }}
                >
                  {t("common.cancelar")}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormAberto(true)}
              className="mt-4 rounded border-slate-400 px-4 py-2 text-sm text-slate-800"
            >
              {estado.cadastrada
                ? t("settings.palavraChaveAlterar")
                : t("settings.palavraChaveCadastrar")}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
