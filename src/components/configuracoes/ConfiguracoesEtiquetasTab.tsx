"use client";

import { useEffect, useState } from "react";
import {
  MODELOS_ETIQUETA,
  carregarConfiguracoesEtiquetas,
  normalizarConfiguracoesEtiquetas,
  persistirConfiguracoesEtiquetasServidor,
  salvarConfiguracoesEtiquetas,
  sincronizarConfiguracoesEtiquetasDoServidor,
  type ConfiguracoesEtiquetas,
  type ModeloEtiquetaId,
} from "@/lib/configuracoes-etiquetas";
import { cn } from "@/lib/utils";

function ToggleSimNao({
  valor,
  onClick,
  titulo,
}: {
  valor: boolean;
  onClick: () => void;
  titulo: string;
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
      {valor ? "Sim" : "Não"}
    </button>
  );
}

export function ConfiguracoesEtiquetasTab() {
  const [config, setConfig] = useState<ConfiguracoesEtiquetas>(() =>
    carregarConfiguracoesEtiquetas()
  );
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    void sincronizarConfiguracoesEtiquetasDoServidor().then((cfg) => {
      if (ativo) {
        setConfig(cfg);
        setCarregando(false);
      }
    });
    return () => {
      ativo = false;
    };
  }, []);

  function aplicar(novaConfig: ConfiguracoesEtiquetas) {
    const normalizado = normalizarConfiguracoesEtiquetas(novaConfig);
    setConfig(normalizado);
    salvarConfiguracoesEtiquetas(novaConfig);
    void persistirConfiguracoesEtiquetasServidor(novaConfig).catch(() => undefined);
  }

  /** Sim: define este modelo como padrão. Sim novamente no padrão atual: remove o padrão (sem auto-selecionar outro). */
  function alternarPadrao(id: ModeloEtiquetaId) {
    if (config.modeloPadrao === id) {
      aplicar({ ...config, modeloPadrao: null });
      return;
    }
    aplicar({ ...config, modeloPadrao: id });
  }

  if (carregando) {
    return <p className="py-8 text-center text-sm text-slate-500">Carregando…</p>;
  }

  return (
    <div className="space-y-3">
      {!config.modeloPadrao ? (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Nenhuma etiqueta padrão selecionada. A impressão de etiquetas ficará desativada até
          marcar <strong>Sim</strong> em um dos modelos abaixo.
        </p>
      ) : null}

      <div className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-left text-[13px] text-slate-700">
          <thead>
            <tr className="border-b border-slate-200 bg-[#f5f6f8]">
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                Nome
              </th>
              <th className="w-32 px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                Padrão
              </th>
            </tr>
          </thead>
          <tbody>
            {MODELOS_ETIQUETA.map((modelo) => (
              <tr
                key={modelo.id}
                className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50"
              >
                <td className="px-4 py-3.5 font-normal text-slate-800">{modelo.nome}</td>
                <td className="px-4 py-3.5 text-right">
                  <ToggleSimNao
                    valor={config.modeloPadrao === modelo.id}
                    onClick={() => alternarPadrao(modelo.id)}
                    titulo={
                      config.modeloPadrao === modelo.id
                        ? "Remover como padrão"
                        : "Definir como etiqueta padrão"
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
