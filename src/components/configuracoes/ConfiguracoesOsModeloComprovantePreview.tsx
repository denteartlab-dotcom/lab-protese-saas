"use client";

import { useMemo } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Code39Barcode } from "@/lib/code39-barcode";
import {
  montarTextosCabecalhoRequisicao,
  normalizarCabecalhoRequisicao,
} from "@/lib/cabecalho-requisicao";
import type { ConfigLaboratorio } from "@/lib/configuracoes-lab";
import { nomeUsuarioDocumentosLaboratorio } from "@/lib/configuracoes-lab";
import { configParaLabImpressao, escalaLogoMultiplicador } from "@/lib/lab-logo";
import {
  estiloLimiteLinhasPaginaPreview,
  estiloLinhaDivisoriaLimitePaginaPreview,
  estiloTabelaMargemColunasPreview,
  estiloLinhaInferiorRequisicaoPreview,
  estiloLinhaRequisicaoPreview,
  estiloMolduraOverlayRequisicaoPreview,
  indicesColunasTotaisOsComprovante,
  largurasColunasOsComprovantePreview,
  estiloPaginaRequisicaoPreview,
  estiloWrapperConteudoRequisicaoPreview,
  gapRequisicaoPreviewMm,
  type OsModelo1Layout,
} from "@/lib/os-modelo1-layout";
import { PREVIEW_OS_MODELO3 } from "@/lib/os-modelo3-layout";
import { OsEtapasListaPreview } from "@/components/configuracoes/OsEtapasListaPreview";
import {
  colaboradorExibirNoTopoImpressao,
  colaboradorMetadadosImpressao,
  PREVIEW_COLABORADORES_OS_LISTA,
  PREVIEW_ETAPAS_OS_LISTA,
} from "@/lib/etapas-os";
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

function LinhaSeparador({ marginTop }: { marginTop?: string }) {
  return (
    <div
      style={{
        ...estiloLinhaDivisoriaLimitePaginaPreview(),
        ...(marginTop ? { marginTop } : undefined),
      }}
    />
  );
}

export function PreviewOsModeloComprovante({
  cfg,
  layout,
}: {
  cfg: ConfigLaboratorio;
  layout: OsModelo1Layout;
}) {
  const { t } = useI18n();
  const lab = useMemo(() => configParaLabImpressao(cfg), [cfg]);
  const cab = useMemo(
    () => normalizarCabecalhoRequisicao(cfg.cabecalhoRequisicao),
    [cfg.cabecalhoRequisicao]
  );
  const textos = useMemo(
    () => montarTextosCabecalhoRequisicao(cfg, lab, cab),
    [cfg, lab, cab]
  );
  const escalaLogo = escalaLogoMultiplicador(cfg.logoTamanho);
  const logoW = Math.round(cab.logoTamanhoPx * escalaLogo);
  const logoH = Math.round(logoW * 0.75);
  const amostra = PREVIEW_OS_MODELO3;
  const fs = layout.tamanhoFonte;
  const fsSmall = Math.max(10, fs - 4);
  const gap = (mm: number) => gapRequisicaoPreviewMm(layout, mm);

  const money = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const totalServicos = amostra.totalServicos;
  const totalDescontos = amostra.totalDescontos;
  const totalFinal = amostra.total;
  const colsTotais = indicesColunasTotaisOsComprovante(layout);
  const mostraEtapasLista = layout.etapas && PREVIEW_ETAPAS_OS_LISTA.length > 0;
  const mostraColaboradorTopo = colaboradorExibirNoTopoImpressao(
    layout.colaborador,
    layout.etapas,
    PREVIEW_ETAPAS_OS_LISTA
  );
  const textoColaboradorTopo = colaboradorMetadadosImpressao({
    explicito: amostra.colaborador,
    colaboradores: PREVIEW_COLABORADORES_OS_LISTA,
    etapas: PREVIEW_ETAPAS_OS_LISTA,
  });

  return (
    <div
      className="mx-auto bg-white text-slate-900 shadow-md"
      style={{
        width: "210mm",
        minHeight: "297mm",
        maxWidth: "100%",
        ...estiloPaginaRequisicaoPreview(),
        fontSize: `${fs}px`,
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div style={estiloWrapperConteudoRequisicaoPreview()}>
        <div aria-hidden style={estiloMolduraOverlayRequisicaoPreview(layout)} />
        <div className="flex items-center gap-3">
          {layout.logo ? (
            <div className="flex shrink-0 items-center self-center">
              {cfg.logoDataUrl?.startsWith("data:image") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cfg.logoDataUrl}
                  alt={t("settings.logo")}
                  style={{ width: logoW, height: logoH, objectFit: "contain" }}
                />
              ) : (
                <div
                  className="flex items-center justify-center border border-dashed border-slate-300 bg-slate-100 text-slate-400"
                  style={{ width: logoW, height: logoH, fontSize: 10 }}
                >
                  {t("settings.logo")}
                </div>
              )}
            </div>
          ) : null}

          {layout.infoLab ? (
            <div className="min-w-0 flex-1">
              <p className="font-bold leading-tight" style={{ fontSize: `${fs + 1}px` }}>
                {textos.nome || "Mateus Bonfim"}
              </p>
              {textos.linhas.map((linha) => (
                <p key={linha} className="leading-snug" style={{ fontSize: `${fsSmall}px` }}>
                  {linha}
                </p>
              ))}
            </div>
          ) : (
            <div className="flex-1" />
          )}

          <div className="shrink-0 text-right" style={{ fontSize: `${fsSmall}px` }}>
            <p className="font-normal">{t("print.os.titulo")}</p>
            <p className="font-bold leading-none" style={{ fontSize: `${fs + 10}px` }}>
              {amostra.numeroOs}
            </p>
            {layout.dataOs ? (
              <p className="mt-1">
                <span className="font-bold">{`${t("print.os.data")}: `}</span>
                {amostra.dataEntrada}
              </p>
            ) : null}
            {layout.usuario ? (
              <p>
                <span className="font-bold">{`${t("print.os.usuario")}: `}</span>
                {nomeUsuarioDocumentosLaboratorio(cfg)}
              </p>
            ) : null}
          </div>
        </div>

        <LinhaSeparador marginTop={gap(2)} />

        <div
          className="grid grid-cols-2 gap-x-8"
          style={{
            fontSize: `${fsSmall}px`,
            marginTop: gap(2),
            rowGap: gap(0.5),
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: gap(0.5) }}>
            {layout.numOs ? (
              <LinhaRotuloValor rotulo={`${t("print.os.numOs")}:`} valor={String(amostra.numeroOs)} />
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
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: gap(0.5) }}>
            {layout.osExterna ? (
              <LinhaRotuloValor rotulo={`${t("print.os.osExterna")}:`} valor={amostra.osExterna} />
            ) : null}
            {layout.caixa ? (
              <LinhaRotuloValor rotulo={`${t("print.os.caixa")}:`} valor={amostra.caixa} />
            ) : null}
            {layout.clienteTel ? (
              <LinhaRotuloValor rotulo={`${t("print.os.telefones")}:`} valor={amostra.telefones} />
            ) : null}
            {layout.clienteEmail ? (
              <LinhaRotuloValor rotulo={`${t("print.os.email")}:`} valor={amostra.email} />
            ) : null}
            {layout.clienteEnd ? (
              <LinhaRotuloValor rotulo={`${t("print.os.endereco")}:`} valor={amostra.endereco} />
            ) : null}
          </div>
        </div>

        <LinhaSeparador marginTop={gap(2)} />

        <div style={{ marginTop: gap(2), ...estiloLimiteLinhasPaginaPreview() }}>
        <table
          className="w-full border-collapse"
          style={{
            fontSize: `${fsSmall}px`,
            tableLayout: "fixed",
            ...estiloTabelaMargemColunasPreview(),
          }}
        >
          <colgroup>
            {largurasColunasOsComprovantePreview(layout).map((w) => (
              <col key={w} style={{ width: w }} />
            ))}
          </colgroup>
          <thead>
            <tr style={estiloLinhaInferiorRequisicaoPreview()}>
              <th className="py-0.5 pr-2 text-left font-bold">{t("print.os.qtd")}</th>
              <th className="py-0.5 pr-2 text-left font-bold">{t("print.os.descricao")}</th>
              {layout.numDente ? (
                <th className="py-0.5 px-1 text-center font-bold">{t("print.os.dente")}</th>
              ) : null}
              {layout.corDente ? (
                <th className="py-0.5 px-1 text-center font-bold">{t("print.os.cor")}</th>
              ) : null}
              {layout.valorUnit ? (
                <th className="py-0.5 px-1 text-right font-bold">{t("print.os.unitario")}</th>
              ) : null}
              {layout.desconto ? (
                <th className="py-0.5 pl-1 text-right font-bold">{t("print.os.desc")}</th>
              ) : null}
              {layout.subtotal ? (
                <th className="py-0.5 pl-1 text-right font-bold">{t("print.os.subtotal")}</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {amostra.itens.map((item, indice) => (
              <tr
                key={item.descricao}
                style={
                  indice < amostra.itens.length - 1 || !layout.total
                    ? estiloLinhaInferiorRequisicaoPreview()
                    : undefined
                }
              >
                <td className="py-0.5 pr-2 align-top">{item.qtd}</td>
                <td className="py-0.5 pr-2 align-top">
                  <div>{item.descricao}</div>
                  {indice === 0 ? (
                    <p style={{ marginTop: gap(0.5), fontSize: `${fsSmall - 1}px` }}>
                      <span>{t("settings.prazoProducao")} </span>
                      <span className="font-bold">{amostra.prazo}</span>
                    </p>
                  ) : null}
                </td>
                {layout.numDente ? (
                  <td className="px-1 py-0.5 text-center align-top">{item.dente}</td>
                ) : null}
                {layout.corDente ? (
                  <td className="px-1 py-0.5 text-center align-top">{item.cor}</td>
                ) : null}
                {layout.valorUnit ? (
                  <td className="px-1 py-0.5 text-right align-top">{money(item.unitario)}</td>
                ) : null}
                {layout.desconto ? (
                  <td className="py-0.5 pl-1 text-right align-top">{item.desconto}</td>
                ) : null}
                {layout.subtotal ? (
                  <td className="py-0.5 pl-1 text-right align-top">{money(item.subtotal)}</td>
                ) : null}
              </tr>
            ))}
          </tbody>
          {layout.total ? (
            <tfoot>
              <tr style={estiloLinhaRequisicaoPreview()}>
                {colsTotais.colspanAntes > 0 ? (
                  <td colSpan={colsTotais.colspanAntes} className="p-0" />
                ) : null}
                <td
                  colSpan={colsTotais.colspanRotulo}
                  className="whitespace-nowrap py-1 text-right align-top"
                >
                  {t("print.os.totalServicos")}
                </td>
                {colsTotais.temSubtotal ? (
                  <td className="whitespace-nowrap py-1 text-right align-top">{money(totalServicos)}</td>
                ) : null}
              </tr>
              <tr>
                {colsTotais.colspanAntes > 0 ? (
                  <td colSpan={colsTotais.colspanAntes} className="p-0" />
                ) : null}
                <td
                  colSpan={colsTotais.colspanRotulo}
                  className="whitespace-nowrap py-0.5 text-right align-top"
                >
                  {t("print.os.descontos")}
                </td>
                {colsTotais.temSubtotal ? (
                  <td className="whitespace-nowrap py-0.5 text-right align-top">{money(totalDescontos)}</td>
                ) : null}
              </tr>
              <tr>
                {colsTotais.colspanAntes > 0 ? (
                  <td colSpan={colsTotais.colspanAntes} className="p-0" />
                ) : null}
                <td
                  colSpan={colsTotais.colspanRotulo}
                  className="whitespace-nowrap py-0.5 text-right align-top font-bold"
                >
                  {t("print.os.totalFinal")}
                </td>
                {colsTotais.temSubtotal ? (
                  <td className="whitespace-nowrap py-0.5 text-right align-top font-bold">
                    {money(totalFinal)}
                  </td>
                ) : null}
              </tr>
            </tfoot>
          ) : null}
        </table>
        </div>

        <div
          style={{
            fontSize: `${fsSmall}px`,
            marginTop: gap(2),
            display: "flex",
            flexDirection: "column",
            gap: gap(0.5),
          }}
        >
          {layout.finalizado ? (
            <p>
              <span>{`${t("print.os.finalizado")}: `}</span>
              <span className="font-bold">{amostra.finalizado}</span>
            </p>
          ) : null}
          {mostraColaboradorTopo ? (
            <p>
              <span>{`${t("print.os.colaborador")}: `}</span>
              <span className="font-bold">{textoColaboradorTopo || ""}</span>
            </p>
          ) : null}
          {layout.produtos && amostra.produtos ? (
            <p>
              <span>{t("settings.produtos")} </span>
              <span className="font-bold">{amostra.produtos}</span>
            </p>
          ) : null}
          {layout.producao ? (
            <p>
              <span>{`${t("print.os.producao")}: `}</span>
              <span className="font-bold">{t("settings.emProducaoPreview")}</span>
            </p>
          ) : null}
        </div>

        {mostraEtapasLista ? (
          <OsEtapasListaPreview
            etapas={PREVIEW_ETAPAS_OS_LISTA}
            colaboradores={PREVIEW_COLABORADORES_OS_LISTA}
            dataEntrada={amostra.dataEntrada}
            fontSize={fsSmall}
            gapMm={`${gap(0.5)}mm`}
            marginTop={`${gap(2)}mm`}
            exibirColaborador={layout.colaborador}
            exibirDatas={layout.etapasComDatas}
          />
        ) : null}

        {layout.materialRec ? (
          <p style={{ fontSize: `${fsSmall}px`, marginTop: gap(2) }}>
            <span>{`${t("print.os.materiais")}: `}</span>
            <span className="font-bold">{amostra.materiais}</span>
          </p>
        ) : null}

        {layout.obsFicha ? (
          <p style={{ fontSize: `${fsSmall}px`, marginTop: gap(1) }}>
            <span>{`${t("print.os.observacao")}: `}</span>
            <span className="font-bold">{amostra.obsFicha}</span>
          </p>
        ) : null}

        {layout.mensagem.trim() ? (
          <p className="italic text-slate-700" style={{ fontSize: `${fsSmall}px`, marginTop: gap(2) }}>
            {layout.mensagem}
          </p>
        ) : null}

        {layout.assinatura ? (
          <div
            className="text-center"
            style={{ fontSize: `${fsSmall - 1}px`, marginTop: gap(6), ...estiloLimiteLinhasPaginaPreview() }}
          >
            <div className="mx-auto w-56" style={estiloLinhaRequisicaoPreview()} />
            <p className="text-slate-800" style={{ marginTop: gap(1) }}>
              {t("print.os.recebiServicos")}
            </p>
          </div>
        ) : null}

        {layout.codBarras ? (
          <div style={{ marginTop: gap(4) }}>
            <Code39Barcode value={`OS${amostra.numeroOs}`} height={36} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
