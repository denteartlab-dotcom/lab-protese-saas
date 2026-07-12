"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import {
  MODELOS_OS,
  MODELOS_OS_IDS,
  ROTAS_MODELO_OS,
  carregarConfiguracoesOs,
  normalizarConfiguracoesOs,
  persistirConfiguracoesOsServidor,
  salvarConfiguracoesOs,
  sincronizarConfiguracoesOsDoServidor,
  type ConfiguracoesOs,
  type ModeloOsId,
} from "@/lib/configuracoes-os";
import { cn } from "@/lib/utils";

function ToggleSimNao({
  valor,
  onClick,
  titulo,
  rotuloSim,
  rotuloNao,
}: {
  valor: boolean;
  onClick: () => void;
  titulo: string;
  rotuloSim: string;
  rotuloNao: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      className={cn(
        "inline-flex min-w-[2.75rem] justify-center rounded px-2.5 py-1 text-[11px] font-semibold leading-none transition",
        valor
          ? "bg-[#5cb85c] text-white hover:bg-[#4cae4c]"
          : "bg-[#d9edf7] text-[#31708f] hover:bg-[#c4e3f3]"
      )}
    >
      {valor ? rotuloSim : rotuloNao}
    </button>
  );
}

export function ConfiguracoesOsTab() {
  const { t } = useI18n();
  const router = useRouter();
  const [config, setConfig] = useState<ConfiguracoesOs>(() => carregarConfiguracoesOs());
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    void sincronizarConfiguracoesOsDoServidor().then((cfg) => {
      if (ativo) {
        setConfig(cfg);
        setCarregando(false);
      }
    });
    return () => {
      ativo = false;
    };
  }, []);

  function aplicar(novaConfig: ConfiguracoesOs) {
    const normalizado = normalizarConfiguracoesOs(novaConfig);
    setConfig(normalizado);
    salvarConfiguracoesOs(novaConfig);
    void persistirConfiguracoesOsServidor(novaConfig).catch(() => undefined);
  }

  function abrirConfigurar(id: ModeloOsId) {
    router.push(ROTAS_MODELO_OS[id]);
  }

  function alternarPadrao(id: ModeloOsId) {
    const ehPadrao = config.modeloPadrao === id;
    const novoPadrao: ModeloOsId = ehPadrao
      ? (MODELOS_OS_IDS.find((m) => m !== id) ?? "modelo1")
      : id;
    aplicar({ ...config, modeloPadrao: novoPadrao });
  }

  function alternarDuasVias(id: ModeloOsId) {
    aplicar({
      ...config,
      duasVias: {
        ...config.duasVias,
        [id]: !config.duasVias[id],
      },
    });
  }

  if (carregando) {
    return <p className="py-8 text-center text-sm text-slate-500">{t("common.carregando")}</p>;
  }

  return (
    <div className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm">
      <table className="w-full border-collapse text-left text-[13px] text-slate-700">
        <thead>
          <tr className="border-b border-slate-200 bg-[#f5f6f8]">
            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              {t("settings.colNome")}
            </th>
            <th className="w-28 px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              {t("settings.colPadrao")}
            </th>
            <th className="w-28 px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              {t("settings.colDuasVias")}
            </th>
            <th className="w-36 px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              {t("settings.colConfigurar")}
            </th>
          </tr>
        </thead>
        <tbody>
          {MODELOS_OS.map((modelo) => (
            <tr
              key={modelo.id}
              className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50"
            >
              <td className="px-4 py-3.5 font-normal text-slate-800">{modelo.nome}</td>
              <td className="px-4 py-3.5 text-center">
                <ToggleSimNao
                  valor={config.modeloPadrao === modelo.id}
                  onClick={() => alternarPadrao(modelo.id)}
                  titulo={t("settings.definirModeloPadrao")}
                  rotuloSim={t("os.imprimir.sim")}
                  rotuloNao={t("os.imprimir.nao")}
                />
              </td>
              <td className="px-4 py-3.5 text-center">
                <ToggleSimNao
                  valor={config.duasVias[modelo.id]}
                  onClick={() => alternarDuasVias(modelo.id)}
                  titulo={t("settings.imprimirDuasVias")}
                  rotuloSim={t("os.imprimir.sim")}
                  rotuloNao={t("os.imprimir.nao")}
                />
              </td>
              <td className="px-4 py-3.5 text-center">
                <button
                  type="button"
                  onClick={() => abrirConfigurar(modelo.id)}
                  className="inline-flex items-center gap-1.5 rounded border border-[#5cb85c] bg-white px-3 py-1.5 text-[12px] font-medium text-[#5cb85c] transition hover:bg-[#f0faf0]"
                >
                  <Settings className="h-3.5 w-3.5" />
                  {t("settings.colConfigurar")}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
