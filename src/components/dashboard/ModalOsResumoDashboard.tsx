"use client";

import { I18nPortal } from "@/components/I18nPortal";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Button, Modal } from "@/components/ui";
import type { TipoPrazoProducao } from "@/lib/controle-producao-prazos";
import { labelStatusTrabalho } from "@/lib/i18n/status-trabalho-i18n";
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
  const { t } = useI18n();

  if (!grupo) return null;

  const servicos = grupo.servicos.length ? grupo.servicos.join(" | ") : "—";
  const situacao = labelStatusTrabalho(t, grupo.status);

  return (
    <Modal open={open} onClose={onClose} title={`${t("dashboard.os")} ${grupo.numeroOs}`} size="md">
      <div className="space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoResumo rotulo={t("dashboard.cliente")} valor={grupo.clienteNome} />
          <CampoResumo rotulo={t("dashboard.paciente")} valor={grupo.pacienteNome} />
          <CampoResumo rotulo={t("dashboard.situacao")} valor={situacao} />
          <CampoResumo rotulo={t("dashboard.caixa")} valor={grupo.caixa || "—"} />
          <CampoResumo rotulo={t("dashboard.prazoLab")} valor={grupo.prazoLab} />
          <CampoResumo rotulo={t("dashboard.prazoDentista")} valor={grupo.prazoDent} />
          <CampoResumo rotulo={t("dashboard.colaborador")} valor={grupo.colaborador} />
          <CampoResumo rotulo={t("dashboard.data")} valor={grupo.dataExibicao} />
        </div>

        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            {t("dashboard.servicos")}
          </p>
          <p className="mt-0.5 text-[13px] leading-snug text-slate-700">{servicos}</p>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("dashboard.fechar")}
          </Button>
          <Link
            href={hrefOsCompletaControle(grupo, painelControle, tipoPrazo)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            onClick={onClose}
          >
            <ExternalLink className="h-4 w-4" />
            {t("dashboard.verOsCompleta")}
          </Link>
        </div>
      </div>
    </Modal>
  );
}
