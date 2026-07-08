"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import type { TipoPrazoProducao } from "@/lib/controle-producao-prazos";
import type { GrupoOsPainelServicos } from "@/lib/painel-servicos-dashboard";

type Props = {
  open: boolean;
  onClose: () => void;
  grupo: GrupoOsPainelServicos | null;
  painelControle: "atrasados" | "vencendo";
  tipoPrazo: TipoPrazoProducao;
};

function hrefOsCompletaControle(
  grupo: GrupoOsPainelServicos,
  painelControle: "atrasados" | "vencendo",
  tipoPrazo: TipoPrazoProducao
) {
  const q = new URLSearchParams({
    editar: grupo.idPrincipal,
    painel: painelControle,
    prazo: tipoPrazo,
  });
  return `/app/producao/controle?${q}`;
}

function CampoResumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{rotulo}</p>
      <p className="mt-0.5 text-[13px] text-slate-700">{valor || "—"}</p>
    </div>
  );
}

export function ModalOsResumoDashboard({
  open,
  onClose,
  grupo,
  painelControle,
  tipoPrazo,
}: Props) {
  if (!grupo) return null;

  const servicos = grupo.servicos.length ? grupo.servicos.join(" | ") : "—";

  return (
    <Modal open={open} onClose={onClose} title={`OS ${grupo.numeroOs}`} size="md">
      <div className="space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoResumo rotulo="Cliente" valor={grupo.clienteNome} />
          <CampoResumo rotulo="Paciente" valor={grupo.pacienteNome} />
          <CampoResumo rotulo="Situação" valor={grupo.situacao} />
          <CampoResumo rotulo="Caixa" valor={grupo.caixa || "—"} />
          <CampoResumo rotulo="Prazo laboratório" valor={grupo.prazoLab} />
          <CampoResumo rotulo="Prazo dentista" valor={grupo.prazoDent} />
          <CampoResumo rotulo="Colaborador" valor={grupo.colaborador} />
          <CampoResumo rotulo="Data" valor={grupo.dataExibicao} />
        </div>

        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Serviço(s)</p>
          <p className="mt-0.5 text-[13px] leading-snug text-slate-700">{servicos}</p>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Link
            href={hrefOsCompletaControle(grupo, painelControle, tipoPrazo)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            onClick={onClose}
          >
            <ExternalLink className="h-4 w-4" />
            Ver OS completa
          </Link>
        </div>
      </div>
    </Modal>
  );
}
