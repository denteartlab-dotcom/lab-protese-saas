"use client";

import { useEffect, useState } from "react";
import { Button, Modal, SelectPesquisavel } from "@/components/ui";
import { useI18n } from "@/components/i18n-provider";

export type ModoFinanceiroDiaria = "despesa" | "cobranca";

type ClienteOpcao = { id: string; nome: string };

type Props = {
  open: boolean;
  modoInicial: ModoFinanceiroDiaria;
  colaboradorNome: string;
  mesLabel: string;
  valorLabel: string;
  dias: number;
  confirmando: boolean;
  onClose: () => void;
  onConfirmar: (modo: ModoFinanceiroDiaria, cliente: ClienteOpcao | null) => void;
};

export function GerarFinanceiroDiariaModal({
  open,
  modoInicial,
  colaboradorNome,
  mesLabel,
  valorLabel,
  dias,
  confirmando,
  onClose,
  onConfirmar,
}: Props) {
  const { t } = useI18n();
  const [modo, setModo] = useState<ModoFinanceiroDiaria>(modoInicial);
  const [clienteId, setClienteId] = useState("");
  const [clientes, setClientes] = useState<ClienteOpcao[]>([]);
  const [carregandoClientes, setCarregandoClientes] = useState(false);

  useEffect(() => {
    if (!open) return;
    setModo(modoInicial);
    setClienteId("");
  }, [open, modoInicial]);

  useEffect(() => {
    if (!open || modo !== "cobranca") return;
    let cancelado = false;
    setCarregandoClientes(true);
    void fetch("/api/clientes", { credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (cancelado) return;
        const lista = Array.isArray(data)
          ? data
              .map((item: { id?: string; nome?: string }) => ({
                id: String(item.id || ""),
                nome: String(item.nome || "").trim(),
              }))
              .filter((item) => item.id && item.nome)
          : [];
        setClientes(lista);
      })
      .catch(() => {
        if (!cancelado) setClientes([]);
      })
      .finally(() => {
        if (!cancelado) setCarregandoClientes(false);
      });
    return () => {
      cancelado = true;
    };
  }, [open, modo]);

  const cliente = clientes.find((item) => item.id === clienteId) || null;

  return (
    <Modal
      open={open}
      onClose={confirmando ? () => undefined : onClose}
      title={t("producao.diarias.financeiroTitulo")}
      size="md"
      layerClassName="z-[80]"
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {colaboradorNome} · {mesLabel} · {t("producao.diarias.dias", { n: dias })} · {valorLabel}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setModo("despesa")}
            className={`rounded-lg border px-3 py-3 text-left text-sm ${
              modo === "despesa"
                ? "border-blue-600 bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100"
                : "border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-200"
            }`}
          >
            <span className="block font-semibold">{t("producao.diarias.gerarDespesa")}</span>
            <span className="mt-1 block text-[12px] leading-snug opacity-80">
              {t("producao.diarias.financeiroDespesaAjuda")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setModo("cobranca")}
            className={`rounded-lg border px-3 py-3 text-left text-sm ${
              modo === "cobranca"
                ? "border-blue-600 bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100"
                : "border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-200"
            }`}
          >
            <span className="block font-semibold">{t("producao.diarias.gerarCobranca")}</span>
            <span className="mt-1 block text-[12px] leading-snug opacity-80">
              {t("producao.diarias.financeiroCobrancaAjuda")}
            </span>
          </button>
        </div>
        {modo === "cobranca" ? (
          <SelectPesquisavel
            label={t("producao.diarias.escolherCliente")}
            value={clienteId}
            onChange={setClienteId}
            options={clientes.map((item) => ({ value: item.id, label: item.nome }))}
            placeholder={
              carregandoClientes
                ? t("producao.diarias.carregandoClientes")
                : t("producao.diarias.buscarCliente")
            }
            emptyMessage={t("producao.diarias.semClientes")}
            disabled={carregandoClientes}
            menuEmPortal
          />
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={confirmando} onClick={onClose}>
            {t("common.cancelar")}
          </Button>
          <Button
            type="button"
            disabled={confirmando || (modo === "cobranca" && !cliente)}
            onClick={() => onConfirmar(modo, modo === "cobranca" ? cliente : null)}
          >
            {confirmando ? t("producao.diarias.gerando") : t("producao.diarias.confirmarGerar")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
