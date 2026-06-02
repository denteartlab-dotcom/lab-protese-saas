"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import { Button, Modal } from "@/components/ui";
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

function BadgeSimNao({ valor }: { valor: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-[2.5rem] justify-center rounded px-2.5 py-1 text-[11px] font-semibold leading-none",
        valor
          ? "bg-[#5cb85c] text-white"
          : "bg-[#d9edf7] text-[#31708f]"
      )}
    >
      {valor ? "Sim" : "Não"}
    </span>
  );
}

export function ConfiguracoesOsTab({ onMensagem }: Props) {
  const router = useRouter();
  const [config, setConfig] = useState<ConfiguracoesOs>(() => carregarConfiguracoesOs());
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [modeloEditando, setModeloEditando] = useState<ModeloOsId | null>(null);
  const [padraoModal, setPadraoModal] = useState(false);
  const [duasViasModal, setDuasViasModal] = useState(false);

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

  const modeloAtual = MODELOS_OS.find((m) => m.id === modeloEditando);

  function abrirConfigurar(id: ModeloOsId) {
    if (id === "modelo1") {
      router.push("/app/configuracoes/os/modelo1");
      return;
    }
    setModeloEditando(id);
    setPadraoModal(config.modeloPadrao === id);
    setDuasViasModal(config.duasVias[id]);
  }

  function fecharModal() {
    setModeloEditando(null);
  }

  async function salvarModelo() {
    if (!modeloEditando) return;
    const novaConfig: ConfiguracoesOs = {
      ...config,
      modeloPadrao: padraoModal ? modeloEditando : config.modeloPadrao,
      duasVias: {
        ...config.duasVias,
        [modeloEditando]: duasViasModal,
      },
    };
    if (padraoModal) {
      novaConfig.modeloPadrao = modeloEditando;
    } else if (config.modeloPadrao === modeloEditando) {
      novaConfig.modeloPadrao = "modelo1";
    }

    setSalvando(true);
    setConfig(novaConfig);
    salvarConfiguracoesOs(novaConfig);
    try {
      await persistirConfiguracoesOsServidor(novaConfig);
      onMensagem?.("Configuração salva com sucesso.", "sucesso");
      fecharModal();
    } catch {
      onMensagem?.(
        "Salvo neste navegador, mas não foi possível gravar no servidor. Tente novamente.",
        "erro"
      );
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return <p className="py-8 text-center text-sm text-slate-500">Carregando…</p>;
  }

  return (
    <>
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
                  <BadgeSimNao valor={config.modeloPadrao === modelo.id} />
                </td>
                <td className="px-4 py-3.5 text-center">
                  <BadgeSimNao valor={config.duasVias[modelo.id]} />
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

      <Modal
        open={modeloEditando !== null}
        onClose={fecharModal}
        title={modeloAtual ? modeloAtual.nome : "Configurar modelo"}
        size="md"
      >
        {modeloAtual ? (
          <div className="space-y-4">
            <label className="flex cursor-pointer items-start gap-3 rounded border border-slate-200 px-4 py-3 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={padraoModal}
                onChange={(e) => setPadraoModal(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[#5cb85c]"
              />
              <span className="text-sm text-slate-700">
                <span className="font-medium">Modelo padrão</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Usado ao abrir a impressão da ordem de serviço.
                </span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded border border-slate-200 px-4 py-3 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={duasViasModal}
                onChange={(e) => setDuasViasModal(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[#5cb85c]"
              />
              <span className="text-sm text-slate-700">
                <span className="font-medium">Imprimir em duas vias</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Gera duas cópias na impressão deste modelo.
                </span>
              </span>
            </label>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button type="button" variant="outline" onClick={fecharModal}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={salvando}
                className="bg-[#5cb85c] hover:bg-[#4cae4c]"
                onClick={() => void salvarModelo()}
              >
                {salvando ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
