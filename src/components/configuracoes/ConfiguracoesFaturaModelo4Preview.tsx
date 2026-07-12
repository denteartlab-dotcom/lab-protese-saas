"use client";

import { Fragment, useMemo } from "react";
import { useI18n } from "@/components/i18n-provider";
import type { ConfigLaboratorio } from "@/lib/configuracoes-lab";
import { nomeUsuarioDocumentosLaboratorio } from "@/lib/configuracoes-lab";
import { configParaLabImpressao } from "@/lib/lab-logo";
import { normalizarCorBorda } from "@/lib/os-modelo1-layout";
import type { ModeloFaturaId } from "@/lib/configuracoes-faturas";
import {
  FATURA_TERMICA_LARGURA_MM,
  PREVIEW_FATURA_TERMICA_AMOSTRA,
  type FaturaModeloLayout,
} from "@/lib/fatura-modelo-layout";
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

/** Preview térmica 80mm — Fatura Modelos 4 e 5 (Smart / Epson T20). */
export function PreviewFaturaModelo4Termica({
  cfg,
  layout,
  modeloId = "modelo4",
}: {
  cfg: ConfigLaboratorio;
  layout: FaturaModeloLayout;
  modeloId?: ModeloFaturaId;
}) {
  const { t } = useI18n();
  const lab = useMemo(() => configParaLabImpressao(cfg), [cfg]);
  const amostra = PREVIEW_FATURA_TERMICA_AMOSTRA;
  const fs = layout.tamanhoFonte;
  const fsSmall = Math.max(9, fs - 2);
  const corLinha = normalizarCorBorda(layout.bordas || "#000000");
  const exibirItens = layout.qtd || layout.servico || layout.valorUnit || layout.desconto;
  const saldoAnteriorNosTotais = modeloId === "modelo5" && layout.saldoAnterior;
  const exibirMetaItem =
    layout.numOs ||
    layout.paciente ||
    layout.dentista ||
    layout.numDente ||
    layout.corDente ||
    layout.data ||
    layout.finalizado;
  const osExternaResumo = [
    ...new Set(
      amostra.linhas
        .map((linha) => linha.osExterna?.trim())
        .filter((valor) => valor && valor !== "-")
    ),
  ].join(", ");

  return (
    <div
      className="mx-auto box-border bg-white text-slate-900 shadow-lg"
      style={{
        width: `${FATURA_TERMICA_LARGURA_MM}mm`,
        maxWidth: "100%",
        padding: "3mm 2mm",
        fontSize: `${fs}px`,
        fontFamily: "Arial, Helvetica, sans-serif",
        boxSizing: "border-box",
      }}
    >
      {layout.data ? (
        <p className="text-right leading-none" style={{ fontSize: `${fsSmall}px` }}>
          {amostra.data}
        </p>
      ) : null}

      {layout.logo ? (
        <div
          className="flex justify-center"
          style={{
            marginTop: layout.logoMargemTopo,
            marginLeft: layout.logoMargemEsq,
          }}
        >
          {cfg.logoDataUrl?.startsWith("data:image") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cfg.logoDataUrl}
              alt={t("settings.logo")}
              style={{
                width: layout.logoTamanhoPx,
                height: Math.round(layout.logoTamanhoPx * 0.85),
                objectFit: "contain",
              }}
            />
          ) : (
            <div
              className="flex items-center justify-center bg-slate-200 text-slate-500"
              style={{
                width: layout.logoTamanhoPx,
                height: Math.round(layout.logoTamanhoPx * 0.85),
                fontSize: 10,
              }}
            >
              {t("settings.logo")}
            </div>
          )}
        </div>
      ) : null}

      {layout.infoLab ? (
        <p
          className="mt-1 text-center font-bold leading-tight"
          style={{ fontSize: `${fs + 1}px` }}
        >
          {lab.responsavel || "Mateus Bonfim"}
        </p>
      ) : null}

      <div className="mt-2 space-y-0.5" style={{ fontSize: `${fsSmall}px` }}>
        {layout.dadosOs ? (
          <LinhaRotuloValor rotulo={`${t("print.fatura.titulo")}:`} valor={String(amostra.numFatura)} />
        ) : null}
        {layout.cliente ? (
          <LinhaRotuloValor rotulo={`${t("print.fatura.cliente")}:`} valor={amostra.cliente} />
        ) : null}
        {layout.clienteTel ? (
          <LinhaRotuloValor rotulo={`${t("print.fatura.telefone")}:`} valor={amostra.telefones} />
        ) : null}
        {layout.osExterna ? (
          <LinhaRotuloValor rotulo={`${t("print.fatura.osExterna")}:`} valor={osExternaResumo || "—"} />
        ) : null}
        {layout.clienteEmail ? (
          <LinhaRotuloValor rotulo={`${t("print.fatura.email")}:`} valor={amostra.email} />
        ) : null}
        {layout.clienteEnd ? (
          <LinhaRotuloValor rotulo={`${t("print.fatura.endereco")}:`} valor={amostra.endereco} />
        ) : null}
        {layout.ultimoPgto ? (
          <LinhaRotuloValor rotulo={`${t("print.fatura.ultimaPgto")}:`} valor={amostra.ultimoPgto} />
        ) : null}
        {layout.saldoAnterior && !saldoAnteriorNosTotais ? (
          <LinhaRotuloValor rotulo={`${t("print.fatura.saldoAnterior")}:`} valor={amostra.saldoAnterior} />
        ) : null}
        {layout.usuario ? (
          <LinhaRotuloValor rotulo={`${t("print.fatura.usuario")}:`} valor={nomeUsuarioDocumentosLaboratorio(cfg)} />
        ) : null}
      </div>

      {exibirItens ? (
        <>
          <LinhaSeparador cor={corLinha} className="mt-2" />
          <table
            className="mt-1.5 w-full border-collapse"
            style={{ fontSize: `${fsSmall}px` }}
          >
            <thead>
              <tr className="border-b" style={{ borderColor: corLinha }}>
                {layout.qtd ? (
                  <th className="w-6 py-0.5 text-left font-bold">{t("print.fatura.col.qtd")}</th>
                ) : null}
                {layout.servico ? (
                  <th className="py-0.5 pr-1 text-left font-bold">{t("print.os.descricao")}</th>
                ) : null}
                {layout.valorUnit ? (
                  <th className="w-[4.2rem] py-0.5 text-right font-bold">{t("print.os.unitario")}</th>
                ) : null}
                {layout.desconto ? (
                  <th className="w-[3.2rem] py-0.5 text-right font-bold">{t("print.os.desc")}</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {amostra.linhas.map((linha) => (
                <Fragment key={linha.os}>
                  <tr>
                    {layout.qtd ? (
                      <td className="align-top font-bold">{linha.qtd}</td>
                    ) : null}
                    {layout.servico ? (
                      <td className="align-top pr-1">{linha.servico}</td>
                    ) : null}
                    {layout.valorUnit ? (
                      <td className="align-top text-right font-normal">{linha.unitario}</td>
                    ) : null}
                    {layout.desconto ? (
                      <td className="align-top text-right font-normal">{linha.desconto}</td>
                    ) : null}
                  </tr>
                  {exibirMetaItem ? (
                    <tr>
                      <td
                        colSpan={
                          [layout.qtd, layout.servico, layout.valorUnit, layout.desconto].filter(
                            Boolean
                          ).length || 1
                        }
                        className="pb-1.5 pt-0.5 align-top font-normal"
                      >
                        <div className="space-y-0.5">
                          {layout.numOs ? (
                            <p>
                              <span>{t("print.fatura.col.os")}: </span>
                              <span className="font-bold">{linha.os}</span>
                            </p>
                          ) : null}
                          {layout.paciente || layout.dentista ? (
                            <p>
                              {layout.paciente ? (
                                <>
                                  <span>{t("print.os.paciente")}: </span>
                                  <span className="font-bold">{linha.paciente}</span>
                                </>
                              ) : null}
                              {layout.paciente && layout.dentista ? " " : null}
                              {layout.dentista ? (
                                <>
                                  <span>{t("print.os.dentista")}: </span>
                                  <span className="font-bold">{amostra.dentista}</span>
                                </>
                              ) : null}
                            </p>
                          ) : null}
                          {layout.numDente || layout.corDente ? (
                            <p>
                              {layout.numDente ? (
                                <>
                                  <span>{t("print.os.dente")}: </span>
                                  <span className="font-bold">{linha.dentes}</span>
                                </>
                              ) : null}
                              {layout.numDente && layout.corDente ? " " : null}
                              {layout.corDente ? (
                                <>
                                  <span>{t("print.os.cor")}: </span>
                                  <span className="font-bold">{linha.cor}</span>
                                </>
                              ) : null}
                            </p>
                          ) : null}
                          {layout.data || layout.finalizado ? (
                            <p>
                              {layout.data ? (
                                <>
                                  <span>{t("print.fatura.dataMeta")}: </span>
                                  <span className="font-bold">{linha.dataOs}</span>
                                </>
                              ) : null}
                              {layout.data && layout.finalizado ? (
                                <span className="mx-1 font-normal">|</span>
                              ) : null}
                              {layout.finalizado ? (
                                <>
                                  <span>{t("print.fatura.entregue")}: </span>
                                  <span className="font-bold">{linha.finalizado}</span>
                                </>
                              ) : null}
                            </p>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
          <LinhaSeparador cor={corLinha} className="mt-1.5" />
        </>
      ) : null}

      {(layout.totalServicos ||
        layout.descontoServicos ||
        layout.descontoFatura ||
        layout.total ||
        saldoAnteriorNosTotais) && (
        <div
          className="mt-1.5 space-y-0.5 text-right"
          style={{ fontSize: `${fsSmall}px` }}
        >
          {layout.totalServicos ? (
            <p>
              <span className="font-bold">{t("print.fatura.totalServicos")}: </span>
              {amostra.totalServicos}
            </p>
          ) : null}
          {saldoAnteriorNosTotais ? (
            <p>
              <span className="font-bold">{t("print.fatura.saldoAnteriorMais")}: </span>
              {amostra.saldoAnterior}
            </p>
          ) : null}
          {layout.descontoServicos ? (
            <p>
              <span className="font-bold">{t("print.fatura.descontoServicos")}: </span>
              {amostra.descontoServicos}
            </p>
          ) : null}
          {layout.descontoFatura ? (
            <p>
              <span className="font-bold">{t("print.fatura.descontoFatura")}: </span>
              {amostra.descontoFatura}
            </p>
          ) : null}
          {layout.total ? (
            <p className="font-bold">
              <span>{t("print.fatura.total")}: </span>
              {amostra.total}
            </p>
          ) : null}
        </div>
      )}

      {layout.condicaoPagamento ? (
        <div className="mt-2" style={{ fontSize: `${fsSmall}px` }}>
          <p className="mb-1 font-bold">{t("print.fatura.condicaoPagamento")}</p>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b" style={{ borderColor: corLinha }}>
                <th className="py-0.5 text-left font-bold">{t("print.fatura.col.parcela")}</th>
                <th className="py-0.5 text-left font-bold">{t("print.fatura.col.vencimento")}</th>
                {layout.formaPgto ? (
                  <th className="py-0.5 text-left font-bold">{t("print.fatura.col.formaPagto")}</th>
                ) : null}
                <th className="py-0.5 text-left font-bold">{t("print.fatura.col.valor")}</th>
              </tr>
            </thead>
            <tbody>
              {amostra.parcelas.map((p) => (
                <tr key={p.parcela}>
                  <td className="py-0.5">{p.parcela}</td>
                  <td className="py-0.5">{p.vencimento}</td>
                  {layout.formaPgto ? <td className="py-0.5">{p.forma}</td> : null}
                  <td className="py-0.5">{p.valor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {layout.observacao ? (
        <p className="mt-2" style={{ fontSize: `${fsSmall}px` }}>
          <span>{t("print.fatura.observacao")}: </span>
          <span className="font-bold">{amostra.observacao}</span>
        </p>
      ) : null}

      {layout.mensagem ? (
        <p
          className="mt-2 text-center italic text-slate-600"
          style={{ fontSize: `${fsSmall}px` }}
        >
          {layout.mensagem}
        </p>
      ) : null}

      {layout.assinatura ? (
        <div className="mt-6 text-center" style={{ fontSize: `${fsSmall - 1}px` }}>
          <p className="lowercase text-slate-800">{t("print.fatura.assinaturaMinusculo")}</p>
          <div className="mx-auto mt-3 w-48 border-t" style={{ borderColor: corLinha }} />
        </div>
      ) : null}

      <div
        className="mt-3 space-y-0.5 text-center leading-snug"
        style={{ fontSize: `${fsSmall}px` }}
      >
        <p>{lab.enderecoLinha1}</p>
        <p>{lab.enderecoLinha2?.replace(" / ", "/")}</p>
        <p>{lab.telefones}</p>
        <p>{t("print.os.email").toLowerCase()}: {lab.email}</p>
      </div>

      {layout.pix ? (
        <div className="mt-4 flex flex-col items-center gap-2">
          {layout.pixQrImagem?.startsWith("data:image") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={layout.pixQrImagem}
              alt={t("settings.pixQrTitulo")}
              style={{
                width: layout.pixQrTamanhoPx,
                height: layout.pixQrTamanhoPx,
                objectFit: "contain",
              }}
            />
          ) : (
            <div
              className="flex items-center justify-center border border-dashed border-slate-400 bg-slate-100 text-slate-500"
              style={{
                width: layout.pixQrTamanhoPx,
                height: layout.pixQrTamanhoPx,
                fontSize: Math.max(7, layout.pixQrFonte - 2),
              }}
            >
              QR PIX
            </div>
          )}
          <span style={{ fontSize: `${layout.pixQrFonte}px` }}>{t("print.fatura.pagarPix")}</span>
        </div>
      ) : null}
    </div>
  );
}
