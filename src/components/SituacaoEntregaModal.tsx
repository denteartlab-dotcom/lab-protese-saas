"use client";

import { useEffect, useState } from "react";
import { Button, Modal } from "@/components/ui";
import { useI18n } from "@/components/i18n-provider";
import {
  atualizarEntrega,
  type EntregaControle,
  type SituacaoEntrega,
} from "@/lib/controle-entregas";
import {
  OPCOES_MODAL_SITUACAO_ENTREGA,
} from "@/lib/i18n/entrega-i18n";

type Props = {
  open: boolean;
  entrega: EntregaControle | null;
  onClose: () => void;
  onSalvo: () => void;
};

export function SituacaoEntregaModal({ open, entrega, onClose, onSalvo }: Props) {
  const { t } = useI18n();
  const [situacao, setSituacao] = useState<SituacaoEntrega>("pendente");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open || !entrega) return;
    const atual =
      entrega.situacao === "em_rota" || entrega.situacao === "entregue"
        ? entrega.situacao
        : "pendente";
    setSituacao(atual);
    setSalvando(false);
  }, [open, entrega]);

  function salvar() {
    if (!entrega || salvando) return;
    setSalvando(true);
    try {
      const patch: Partial<EntregaControle> = { situacao };
      if (situacao === "entregue") {
        patch.dataFinalizado = new Date().toISOString();
      } else {
        patch.dataFinalizado = null;
      }
      atualizarEntrega(entrega.id, patch);
      onSalvo();
      onClose();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open={open && Boolean(entrega)}
      onClose={onClose}
      title={t("producao.entregas.modalSituacao.titulo")}
      size="sm"
    >
      {entrega ? (
        <div className="space-y-4 text-[12px] text-slate-600">
          <p className="text-[11px] text-slate-500">
            {t("producao.entregas.modalSituacao.descricao")}
          </p>
          <p>
            <span className="font-semibold text-slate-700">
              {t("producao.entregas.modalSituacao.destinatario")}:
            </span>{" "}
            {entrega.destinatario}
          </p>

          <div className="space-y-2" role="radiogroup" aria-label={t("producao.comum.situacao")}>
            {OPCOES_MODAL_SITUACAO_ENTREGA.map((opcao) => {
              const selecionada = situacao === opcao.value;
              return (
                <button
                  key={opcao.value}
                  type="button"
                  role="radio"
                  aria-checked={selecionada}
                  onClick={() => setSituacao(opcao.value)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                    selecionada
                      ? "border-blue-400 bg-blue-50 ring-1 ring-blue-200"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      selecionada
                        ? "border-blue-500 bg-blue-500 text-white"
                        : "border-slate-300 bg-white"
                    }`}
                    aria-hidden
                  >
                    {selecionada ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    ) : null}
                  </span>
                  <span
                    className={`inline-flex rounded px-2 py-0.5 text-[11px] font-semibold ${opcao.badge}`}
                  >
                    {t(opcao.labelKey)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={salvando}>
              {t("common.cancelar")}
            </Button>
            <Button type="button" size="sm" onClick={salvar} disabled={salvando}>
              {t("producao.entregas.modalSituacao.salvar")}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
