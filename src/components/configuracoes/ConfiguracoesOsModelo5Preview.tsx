"use client";

import { Fragment, useMemo } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Code39Barcode } from "@/lib/code39-barcode";
import { configParaLabImpressao } from "@/lib/lab-logo";
import type { ConfigLaboratorio } from "@/lib/configuracoes-lab";
import { nomeUsuarioDocumentosLaboratorio } from "@/lib/configuracoes-lab";
import { normalizarCorBorda } from "@/lib/os-modelo1-layout";
import { PREVIEW_OS_MODELO5, type OsModelo5Layout } from "@/lib/os-modelo5-layout";
import { cn } from "@/lib/utils";

function LinhaRotuloValor({
  rotulo,
  valor,
  className,
}: {
  rotulo: string;
  valor: string;
  className?: string;
}) {
  return (
    <p className={cn("leading-snug text-slate-900", className)}>
      <span>{rotulo}</span>
      <span className="font-bold"> {valor}</span>
    </p>
  );
}

function LinhaSeparador({ cor, className }: { cor: string; className?: string }) {
  return (
    <div className={cn("border-t", className)} style={{ borderColor: cor }} />
  );
}

/** Preview térmica 80mm — Modelo 5 comprovante de entrega (Smart / Epson T20). */
export function PreviewOsModelo5Termica({
  cfg,
  layout,
}: {
  cfg: ConfigLaboratorio;
  layout: OsModelo5Layout;
}) {
  const { t } = useI18n();
  const lab = useMemo(() => configParaLabImpressao(cfg), [cfg]);
  const amostra = PREVIEW_OS_MODELO5;
  const fs = layout.tamanhoFonte;
  const fsSmall = Math.max(9, fs - 2);
  const corLinha = normalizarCorBorda(layout.bordas);
  const logoPx = Math.min(56, Math.round(layout.logoTamanhoPx * 0.47));

  const money = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div
      className="mx-auto box-border bg-white text-slate-900 shadow-lg"
      style={{
        width: "72mm",
        maxWidth: "100%",
        padding: "3mm 2mm",
        fontSize: `${fs}px`,
        fontFamily: "Arial, Helvetica, sans-serif",
        boxSizing: "border-box",
      }}
    >
      <div className="flex items-start justify-between gap-1">
        {layout.logo ? (
          <div className="shrink-0">
            {cfg.logoDataUrl?.startsWith("data:image") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cfg.logoDataUrl}
                alt={t("settings.logo")}
                style={{
                  width: logoPx,
                  height: Math.round(logoPx * 0.85),
                  objectFit: "contain",
                }}
              />
            ) : (
              <div
                className="flex items-center justify-center bg-slate-200 text-slate-500"
                style={{ width: logoPx, height: Math.round(logoPx * 0.85), fontSize: 9 }}
              >
                {t("settings.logo")}
              </div>
            )}
          </div>
        ) : (
          <span />
        )}
        {layout.dataOs ? (
          <p
            className="shrink-0 pt-0.5 text-right leading-none"
            style={{ fontSize: `${fsSmall}px` }}
          >
            {amostra.dataEntrada}
          </p>
        ) : null}
      </div>

      {layout.infoLab ? (
        <p
          className="mt-1 text-center font-bold leading-tight"
          style={{ fontSize: `${fs + 1}px` }}
        >
          {lab.responsavel || "Mateus Bonfim"}
        </p>
      ) : null}

      <div className="mt-2 space-y-0.5" style={{ fontSize: `${fsSmall}px` }}>
        {layout.numOs ? (
          <LinhaRotuloValor rotulo={`${t("print.os.numOs")}:`} valor={String(amostra.numeroOs)} />
        ) : null}
        {layout.osExterna ? (
          <LinhaRotuloValor rotulo={`${t("print.os.osInterna")}:`} valor={amostra.osInterna} />
        ) : null}
        {layout.caixa ? (
          <LinhaRotuloValor rotulo={`${t("print.os.caixa")}:`} valor={amostra.caixa} />
        ) : null}
        {layout.cliente ? (
          <LinhaRotuloValor rotulo={`${t("print.os.cliente")}:`} valor={amostra.cliente} />
        ) : null}
        {layout.dentista ? (
          <LinhaRotuloValor rotulo={`${t("print.os.dentista")}:`} valor={amostra.dentista} />
        ) : null}
        {layout.paciente ? (
          <LinhaRotuloValor rotulo={`${t("print.os.paciente")}:`} valor={amostra.paciente} />
        ) : null}
        {layout.clienteTel ? (
          <LinhaRotuloValor rotulo={`${t("print.fatura.telefone")}:`} valor={amostra.telefone} />
        ) : null}
        {layout.clienteEmail ? (
          <LinhaRotuloValor rotulo={`${t("print.os.email")}:`} valor={amostra.email} />
        ) : null}
        {layout.clienteEnd ? (
          <LinhaRotuloValor rotulo={`${t("print.os.endereco")}:`} valor={amostra.endereco} />
        ) : null}
        {layout.usuario ? (
          <LinhaRotuloValor
            rotulo={`${t("print.os.usuario")}:`}
            valor={nomeUsuarioDocumentosLaboratorio(cfg)}
          />
        ) : null}
      </div>

      {layout.produtos ? (
        <>
          <LinhaSeparador cor={corLinha} className="mt-2" />
          <table
            className="mt-1.5 w-full border-collapse"
            style={{ fontSize: `${fsSmall}px` }}
          >
            <thead>
              <tr className="border-b" style={{ borderColor: corLinha }}>
                <th className="w-6 py-0.5 text-left font-bold">{t("print.os.qtd")}</th>
                <th className="py-0.5 pr-1 text-left font-bold">{t("print.os.descricao")}</th>
                {layout.valorUnit ? (
                  <th className="w-[4.2rem] py-0.5 text-right font-bold">{t("print.os.unitario")}</th>
                ) : null}
                {layout.desconto ? (
                  <th className="w-[3.2rem] py-0.5 text-right font-bold">{t("print.os.descontosCol")}</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {amostra.itens.map((row) => (
                <Fragment key={row.descricao}>
                  <tr>
                    <td className="align-top font-bold">{row.qtd}</td>
                    <td
                      className="align-top pr-1"
                      colSpan={layout.valorUnit && layout.desconto ? 1 : undefined}
                    >
                      {row.descricao}
                    </td>
                    {layout.valorUnit ? <td className="align-top" /> : null}
                    {layout.desconto ? <td className="align-top" /> : null}
                  </tr>
                  {(layout.valorUnit || layout.desconto) && (
                    <tr>
                      <td />
                      <td />
                      {layout.valorUnit ? (
                        <td className="align-top text-right font-normal">
                          {money(row.unitario)}
                        </td>
                      ) : null}
                      {layout.desconto ? (
                        <td className="align-top text-right font-normal">{row.desconto}</td>
                      ) : null}
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          <div className="mt-1 space-y-0.5" style={{ fontSize: `${fsSmall}px` }}>
            {layout.numDente ? (
              <p>
                <span>{`${t("print.fatura.col.numDente")}: `}</span>
                <span className="font-bold">{amostra.itens[0].dente}</span>
              </p>
            ) : null}
            {layout.corDente ? (
              <p>
                <span>{`${t("print.os.cor")} ${t("print.os.dente").replace(/^Número /, "")}: `}</span>
                <span className="font-bold">{amostra.itens[0].cor}</span>
              </p>
            ) : null}
            {layout.dataPrazo || layout.finalizado ? (
              <p>
                {layout.dataPrazo ? (
                  <>
                    <span>{`${t("print.os.prazo")}: `}</span>
                    <span className="font-bold">{amostra.prazo}</span>
                  </>
                ) : null}
                {layout.dataPrazo && layout.finalizado ? " " : null}
                {layout.finalizado ? (
                  <>
                    <span>{`${t("print.os.finalizado")}: `}</span>
                    <span className="font-bold">{amostra.finalizado}</span>
                  </>
                ) : null}
              </p>
            ) : null}
            {layout.colaborador ? (
              <p>
                <span>{`${t("print.os.colaborador")}: `}</span>
                <span className="font-bold">{amostra.colaborador}</span>
              </p>
            ) : null}
          </div>
          <LinhaSeparador cor={corLinha} className="mt-1.5" />
        </>
      ) : null}

      {(layout.subtotal || layout.total) && layout.produtos ? (
        <div
          className="mt-1.5 space-y-0.5 text-right"
          style={{ fontSize: `${fsSmall}px` }}
        >
          {layout.subtotal ? (
            <p>
              <span className="font-bold">{`${t("print.os.subtotal")}: `}</span>
              {money(amostra.total)}
            </p>
          ) : null}
          <p>
            <span className="font-bold">{`${t("print.fatura.totalServicosIgual").replace(" (=)", "")}: `}</span>
            {money(amostra.totalServicos)}
          </p>
          {layout.desconto ? (
            <p>
              <span className="font-bold">{`(-) ${t("print.os.descontosCol")}: `}</span>
              {money(amostra.totalDescontos)}
            </p>
          ) : null}
          {layout.total ? (
            <p className="font-bold">
              <span>{`${t("print.os.totalFinal")}: `}</span>
              {money(amostra.total)}
            </p>
          ) : null}
        </div>
      ) : null}

      {layout.materialRec ? (
        <p className="mt-2" style={{ fontSize: `${fsSmall}px` }}>
          <span>{`${t("print.os.materiais")}: `}</span>
          <span className="font-bold">{amostra.materiais}</span>
        </p>
      ) : null}

      {layout.obsFicha ? (
        <p className="mt-1.5" style={{ fontSize: `${fsSmall}px` }}>
          <span>{`${t("print.os.observacao")}: `}</span>
          <span className="font-bold">{amostra.obsFicha}</span>
        </p>
      ) : null}

      {layout.assinatura ? (
        <div className="mt-6 text-center" style={{ fontSize: `${fsSmall - 1}px` }}>
          <div className="mx-auto w-48 border-t" style={{ borderColor: corLinha }} />
          <p className="mt-1.5 lowercase text-slate-800">{t("print.fatura.assinaturaMinusculo")}</p>
        </div>
      ) : null}

      <div
        className="mt-3 space-y-0.5 text-center leading-snug"
        style={{ fontSize: `${fsSmall}px` }}
      >
        <p>{lab.enderecoLinha1}</p>
        <p>{lab.enderecoLinha2?.replace(" / ", "/")}</p>
        <p>{lab.telefones}</p>
        <p>{`${t("print.os.email").toLowerCase()}: ${lab.email}`}</p>
      </div>

      {layout.codBarras ? (
        <div className="mt-4 flex flex-col items-center">
          <Code39Barcode value={`OS${amostra.numeroOs}`} height={32} />
        </div>
      ) : null}
    </div>
  );
}
