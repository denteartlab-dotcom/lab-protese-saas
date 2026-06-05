"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import type { TipoMensagemForm } from "@/components/DadosLaboratorioForm";
import {
  MODELOS_OS,
  carregarConfiguracoesOs,
  persistirConfiguracoesOsServidor,
  salvarConfiguracoesOs,
  sincronizarConfiguracoesOsDoServidor,
  type ConfiguracoesOs,
  type ModeloOsId,
} from "@/lib/configuracoes-os";
import { cn } from "@/lib/utils";

type Props = {
  onMensagem?: (texto: string, tipo?: TipoMensagemForm) => void;
};

function ToggleSimNao({
  valor,
  onClick,
  disabled,
  titulo,
}: {
  valor: boolean;
  onClick: () => void;
  disabled?: boolean;
  titulo: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={titulo}
      className={cn(
        "inline-flex min-w-[2.75rem] justify-center rounded px-2.5 py-1 text-[11px] font-semibold leading-none transition",
        valor
          ? "bg-[#5cb85c] text-white hover:bg-[#4cae4c]"
          : "bg-[#d9edf7] text-[#31708f] hover:bg-[#c4e3f3]",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      {valor ? "Sim" : "Não"}
    </button>
  );
}

const ROTAS_MODELO_OS: Record<ModeloOsId, string> = {
  modelo1: "/app/configuracoes/os/modelo1",
  modelo2: "/app/configuracoes/os/modelo2",
  modelo3: "/app/configuracoes/os/modelo3",
  modelo4: "/app/configuracoes/os/modelo4",
  modelo5: "/app/configuracoes/os/modelo5",
};

export function ConfiguracoesOsTab({ onMensagem }: Props) {
  const router = useRouter();
  const [config, setConfig] = useState<ConfiguracoesOs>(() => carregarConfiguracoesOs());
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

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

  async function persistir(novaConfig: ConfiguracoesOs) {
    setSalvando(true);
    setConfig(novaConfig);
    salvarConfiguracoesOs(novaConfig);
    try {
      await persistirConfiguracoesOsServidor(novaConfig);
      onMensagem?.("Configuração salva com sucesso.", "sucesso");
    } catch {
      onMensagem?.(
        "Salvo neste navegador, mas não foi possível gravar no servidor. Tente novamente.",
        "erro"
      );
    } finally {
      setSalvando(false);
    }
  }

  function abrirConfigurar(id: ModeloOsId) {
    router.push(ROTAS_MODELO_OS[id]);
  }

  async function alternarPadrao(id: ModeloOsId) {
    if (salvando) return;
    const jaPadrao = config.modeloPadrao === id;
    await persistir({
      ...config,
      modeloPadrao: jaPadrao ? "modelo1" : id,
    });
  }

  async function alternarDuasVias(id: ModeloOsId) {
    if (salvando) return;
    await persistir({
      ...config,
      duasVias: {
        ...config.duasVias,
        [id]: !config.duasVias[id],
      },
    });
  }

  if (carregando) {
    return <p className="py-8 text-center text-sm text-slate-500">Carregando…</p>;
  }

  return (
    <div className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm">
      <table className="w-full border-collapse text-left text-[13px] text-slate-700">
        <thead>
          <tr className="border-b border-slate-200 bg-[#f5f6f8]">
            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              Nome
            </th>
            <th className="w-28 px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              Padrão
            </th>
            <th className="w-28 px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              Duas vias
            </th>
            <th className="w-36 px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              Configurar
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
                  onClick={() => void alternarPadrao(modelo.id)}
                  disabled={salvando}
                  titulo={
                    config.modeloPadrao === modelo.id
                      ? "Clique para remover como modelo padrão"
                      : "Clique para definir como modelo padrão"
                  }
                />
              </td>
              <td className="px-4 py-3.5 text-center">
                <ToggleSimNao
                  valor={config.duasVias[modelo.id]}
                  onClick={() => void alternarDuasVias(modelo.id)}
                  disabled={salvando}
                  titulo={
                    config.duasVias[modelo.id]
                      ? "Clique para desativar impressão em duas vias"
                      : "Clique para ativar impressão em duas vias"
                  }
                />
              </td>
              <td className="px-4 py-3.5 text-center">
                <button
                  type="button"
                  onClick={() => abrirConfigurar(modelo.id)}
                  className="inline-flex items-center gap-1.5 rounded border border-[#5cb85c] bg-white px-3 py-1.5 text-[12px] font-medium text-[#5cb85c] transition hover:bg-[#f0faf0]"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Configurar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
