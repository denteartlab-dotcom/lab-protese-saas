"use client";

import { useEffect, useState } from "react";
import { Printer, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Button, Modal, Select } from "@/components/ui";
import type { EntregaControle } from "@/lib/controle-entregas";
import {
  imprimirEtiquetaEntrega,
  type FormatoEtiquetaEnvio,
  type ModeloEtiquetaA4,
} from "@/lib/etiqueta-envio-entrega";

type ImprimirEtiquetaEntregaModalProps = {
  open: boolean;
  entrega: EntregaControle | null;
  onClose: () => void;
};

export function ImprimirEtiquetaEntregaModal({
  open,
  entrega,
  onClose,
}: ImprimirEtiquetaEntregaModalProps) {
  const { t } = useI18n();
  const [formato, setFormato] = useState<FormatoEtiquetaEnvio>("a4");
  const [modeloA4, setModeloA4] = useState<ModeloEtiquetaA4>("modelo1");
  const [duasVias, setDuasVias] = useState("nao");

  useEffect(() => {
    if (!open) return;
    setFormato("a4");
    setModeloA4("modelo1");
    setDuasVias("nao");
  }, [open, entrega?.id]);

  function imprimir() {
    if (!entrega) return;
    const abriu = imprimirEtiquetaEntrega(
      entrega,
      {
        titulo: t("producao.entregas.etiqueta.titulo"),
        destinatario: t("producao.entregas.etiqueta.destinatario"),
        remetente: t("producao.entregas.etiqueta.remetente"),
        os: t("producao.controle.tabela.os"),
        cep: t("producao.entregas.etiqueta.cep"),
        remetenteSemCadastro: t("producao.entregas.etiqueta.remetenteSemCadastro"),
        imprimir: t("producao.comum.imprimir"),
        fechar: t("common.fechar"),
      },
      {
        formato,
        modeloA4,
        duasVias: duasVias === "sim",
      }
    );
    if (!abriu) {
      alert(t("print.comum.erroAbrirPopups"));
      return;
    }
    onClose();
  }

  const numerosOs = (entrega?.numeroOs || "").trim();
  const destinatario = (entrega?.destinatario || "").trim();

  return (
    <Modal open={open} onClose={onClose} title={t("producao.entregas.etiqueta.modalTitulo")} size="lg">
      {entrega ? (
        <div className="space-y-4">
          <div className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-center text-sm font-semibold text-sky-900">
            {numerosOs
              ? t("producao.entregas.etiqueta.bannerOs", { n: numerosOs })
              : t("producao.entregas.etiqueta.titulo")}
            {destinatario ? (
              <span className="mt-1 block text-xs font-normal text-sky-800">{destinatario}</span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-700">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="formato-etiqueta-envio"
                checked={formato === "a4"}
                onChange={() => setFormato("a4")}
                className="accent-primary-600"
              />
              {t("os.imprimir.formatoA4")}
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="formato-etiqueta-envio"
                checked={formato === "termica"}
                onChange={() => setFormato("termica")}
                className="accent-primary-600"
              />
              {t("os.imprimir.formatoTermica")}
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="formato-etiqueta-envio"
                checked={formato === "etiqueta"}
                onChange={() => setFormato("etiqueta")}
                className="accent-primary-600"
              />
              {t("producao.entregas.etiqueta.formatoCompacta")}
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {formato === "a4" ? (
              <Select
                label={t("producao.entregas.etiqueta.modeloA4")}
                value={modeloA4}
                onChange={(e) => setModeloA4(e.target.value as ModeloEtiquetaA4)}
              >
                <option value="modelo1">{t("producao.entregas.etiqueta.modelo1")}</option>
                <option value="modelo2">{t("producao.entregas.etiqueta.modelo2")}</option>
              </Select>
            ) : (
              <Select
                label={
                  formato === "termica"
                    ? t("producao.entregas.etiqueta.modeloTermica")
                    : t("producao.entregas.etiqueta.modeloCompacta")
                }
                value={formato}
                onChange={() => undefined}
              >
                <option value={formato}>
                  {formato === "termica"
                    ? t("producao.entregas.etiqueta.modeloTermicaUnico")
                    : t("producao.entregas.etiqueta.modelo100x150")}
                </option>
              </Select>
            )}

            <Select
              label={t("os.imprimir.duasVias")}
              value={duasVias}
              onChange={(e) => setDuasVias(e.target.value)}
            >
              <option value="nao">{t("os.imprimir.nao")}</option>
              <option value="sim">{t("os.imprimir.sim")}</option>
            </Select>
          </div>

          <p className="text-center text-xs text-slate-500">{t("producao.entregas.etiqueta.ajuda")}</p>

          <div className="flex justify-center gap-3 border-t border-slate-100 pt-4">
            <Button type="button" className="bg-emerald-600 hover:bg-emerald-700" onClick={imprimir}>
              <Printer className="h-4 w-4" />
              {t("os.imprimir.imprimir")}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              <X className="h-4 w-4 text-red-500" />
              {t("os.imprimir.fechar")}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
