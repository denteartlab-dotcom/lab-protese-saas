"use client";

import { Fragment } from "react";
import {
  nomeExibicaoLaboratorio,
  type ConfigLaboratorio,
} from "@/lib/configuracoes-lab";
import {
  montarTextosCabecalhoRequisicao,
  normalizarCabecalhoRequisicao,
} from "@/lib/cabecalho-requisicao";
import {
  estiloLinhaDivisoriaFaturaPreview,
  estiloLinhaInferiorFaturaPreview,
  estiloLimiteLinhasFaturaPreview,
  estiloMolduraFaturaPreview,
  estiloPaginaFaturaPreview,
  estiloTabelaMargemFaturaPreview,
  estiloWrapperFaturaPreview,
  PREVIEW_FATURA_AMOSTRA,
  type FaturaModeloLayout,
} from "@/lib/fatura-modelo-layout";
import { configParaLabImpressao, escalaLogoMultiplicador } from "@/lib/lab-logo";

type Props = {
  cfg: ConfigLaboratorio;
  layout: FaturaModeloLayout;
  termica?: boolean;
};

function LinhaSeparador({ marginTop }: { marginTop?: string }) {
  return <div style={{ ...estiloLinhaDivisoriaFaturaPreview(), marginTop }} />;
}

function LinhaRotuloValor({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <p>
      <span className="font-bold">{rotulo} </span>
      {valor}
    </p>
  );
}

export function ConfiguracoesFaturaModeloPreview({ cfg, layout, termica }: Props) {
  const lab = configParaLabImpressao(cfg);
  const amostra = PREVIEW_FATURA_AMOSTRA;
  const fs = layout.tamanhoFonte;
  const fsSmall = Math.max(7, fs - 2);
  const fsMetaLinha = Math.max(9, fs - 3);
  const exibirMetaLinha =
    layout.data || layout.finalizado || layout.osExterna || layout.corDente;
  const cab = normalizarCabecalhoRequisicao(cfg.cabecalhoRequisicao);
  const textos = montarTextosCabecalhoRequisicao(cfg, lab, cab);
  const escalaLogo = escalaLogoMultiplicador(cfg.logoTamanho);
  const logoW = Math.round(cab.logoTamanhoPx * escalaLogo);
  const logoH = Math.round(logoW * 0.75);

  if (termica) {
    return (
      <div className="mx-auto flex justify-center">
        <div
          className="bg-white text-[#111] shadow-md"
          style={{
            width: "226px",
            fontSize: `${Math.max(8, fs - 2)}px`,
            padding: "4mm",
            boxSizing: "border-box",
          }}
        >
          <p className="text-center font-bold">Modelo térmico 60mm</p>
          <p className="mt-2 text-center text-[10px] text-slate-500">
            Pré-visualização resumida do cupom térmico.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex justify-center">
      <div
        className="shadow-md"
        style={{ ...estiloPaginaFaturaPreview(), fontSize: `${fs}px` }}
      >
        <div style={estiloWrapperFaturaPreview()}>
          <div aria-hidden style={estiloMolduraFaturaPreview(layout)} />

          <div className="flex items-start gap-3">
            {layout.logo ? (
              <div className="shrink-0">
                {cfg.logoDataUrl?.startsWith("data:image") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cfg.logoDataUrl}
                    alt="Logo"
                    style={{ width: logoW, height: logoH, objectFit: "contain" }}
                  />
                ) : (
                  <div
                    className="flex items-center justify-center border border-dashed border-slate-300 bg-slate-100 text-slate-400"
                    style={{ width: logoW, height: logoH, fontSize: 10 }}
                  >
                    Logo
                  </div>
                )}
              </div>
            ) : null}

            {layout.infoLab ? (
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="font-bold leading-tight" style={{ fontSize: `${fs + 1}px` }}>
                  {textos.nome || nomeExibicaoLaboratorio(cfg)}
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

            {layout.dadosOs || layout.usuario ? (
              <div className="shrink-0 text-right" style={{ fontSize: `${fsSmall}px` }}>
                {layout.dadosOs ? (
                  <>
                    <p className="font-normal">Fatura</p>
                    <p className="font-bold leading-none" style={{ fontSize: `${fs + 8}px` }}>
                      {amostra.numFatura}
                    </p>
                    {layout.data ? (
                      <p className="mt-1">
                        <span className="font-bold">Data: </span>
                        {amostra.data}
                      </p>
                    ) : null}
                  </>
                ) : null}
                {layout.usuario ? (
                  <p>
                    <span className="font-bold">Usuário: </span>
                    {amostra.usuario}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <LinhaSeparador marginTop="2mm" />

          <div
            className="grid grid-cols-2 gap-x-8"
            style={{ fontSize: `${fsSmall}px`, marginTop: "2mm", rowGap: "1mm" }}
          >
            <div className="flex flex-col gap-[1mm]">
              {layout.cliente ? (
                <LinhaRotuloValor rotulo="Cliente:" valor={amostra.cliente} />
              ) : null}
              {layout.dentista ? (
                <LinhaRotuloValor rotulo="Dentista:" valor={amostra.dentista} />
              ) : null}
              {layout.clienteTel ? (
                <LinhaRotuloValor rotulo="Telefone:" valor={amostra.telefones} />
              ) : null}
              {layout.ultimoPgto ? (
                <LinhaRotuloValor rotulo="Último Pgto:" valor={amostra.ultimoPgto} />
              ) : null}
              {layout.saldoAnterior ? (
                <LinhaRotuloValor rotulo="Saldo Anterior:" valor={amostra.saldoAnterior} />
              ) : null}
            </div>
            <div className="flex flex-col gap-[1mm]">
              {layout.clienteEmail ? (
                <LinhaRotuloValor rotulo="Email:" valor={amostra.email} />
              ) : null}
              {layout.clienteEnd ? (
                <LinhaRotuloValor rotulo="Endereço:" valor={amostra.endereco} />
              ) : null}
            </div>
          </div>

          <LinhaSeparador marginTop="2mm" />

          <div style={{ marginTop: "2mm", ...estiloLimiteLinhasFaturaPreview() }}>
            <table
              className="w-full border-collapse"
              style={{ fontSize: `${fsSmall}px`, ...estiloTabelaMargemFaturaPreview() }}
            >
              <thead>
                <tr style={estiloLinhaInferiorFaturaPreview()}>
                  {layout.numOs ? <th className="py-0.5 pr-1 text-left font-bold">OS</th> : null}
                  {layout.qtd ? <th className="py-0.5 pr-1 text-center font-bold">Qtd</th> : null}
                  {layout.servico ? (
                    <th className="py-0.5 pr-1 text-left font-bold">Serviços/Produtos</th>
                  ) : null}
                  {layout.numDente ? (
                    <th className="px-1 py-0.5 text-left font-bold">Num Dente</th>
                  ) : null}
                  {layout.paciente ? (
                    <th className="px-1 py-0.5 text-left font-bold">Paciente</th>
                  ) : null}
                  {layout.valorUnit ? (
                    <th className="px-1 py-0.5 text-right font-bold">Unitário</th>
                  ) : null}
                  {layout.desconto ? <th className="px-1 py-0.5 text-right font-bold">Desc</th> : null}
                  {layout.subtotal ? (
                    <th className="py-0.5 pl-1 text-right font-bold">Subtotal</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {amostra.linhas.map((linha, indice) => (
                  <Fragment key={linha.os}>
                    <tr
                      style={
                        !exibirMetaLinha && indice < amostra.linhas.length - 1
                          ? estiloLinhaInferiorFaturaPreview()
                          : undefined
                      }
                    >
                      {layout.numOs ? (
                        <td className="py-0.5 pr-1 align-top font-medium">{linha.os}</td>
                      ) : null}
                      {layout.qtd ? (
                        <td className="py-0.5 pr-1 text-center align-top">{linha.qtd}</td>
                      ) : null}
                      {layout.servico ? (
                        <td className="py-0.5 pr-1 align-top">{linha.servico}</td>
                      ) : null}
                      {layout.numDente ? (
                        <td className="px-1 py-0.5 align-top">{linha.dentes}</td>
                      ) : null}
                      {layout.paciente ? (
                        <td className="px-1 py-0.5 align-top">{linha.paciente}</td>
                      ) : null}
                      {layout.valorUnit ? (
                        <td className="px-1 py-0.5 text-right align-top">{linha.unitario}</td>
                      ) : null}
                      {layout.desconto ? (
                        <td className="px-1 py-0.5 text-right align-top">{linha.desconto}</td>
                      ) : null}
                      {layout.subtotal ? (
                        <td className="py-0.5 pl-1 text-right align-top">{linha.subtotal}</td>
                      ) : null}
                    </tr>
                    {exibirMetaLinha ? (
                      <tr>
                        <td
                          colSpan={
                            [
                              layout.numOs,
                              layout.qtd,
                              layout.servico,
                              layout.numDente,
                              layout.paciente,
                              layout.valorUnit,
                              layout.desconto,
                              layout.subtotal,
                            ].filter(Boolean).length
                          }
                          className="py-0.5 text-slate-700"
                          style={{ fontSize: `${fsMetaLinha}px` }}
                        >
                          {layout.data ? (
                            <span className="mr-3">
                              <span className="font-bold">Data: </span>
                              {linha.dataOs}
                            </span>
                          ) : null}
                          {layout.finalizado ? (
                            <span className="mr-3">
                              <span className="font-bold">Finalizado: </span>
                              {linha.finalizado}
                            </span>
                          ) : null}
                          {layout.osExterna ? (
                            <span className="mr-3">
                              <span className="font-bold">OS Externa: </span>
                              {linha.osExterna}
                            </span>
                          ) : null}
                          {layout.corDente ? (
                            <span>
                              <span className="font-bold">Cor: </span>
                              {linha.cor}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {(layout.totalServicos ||
            layout.descontoServicos ||
            layout.descontoFatura ||
            layout.total) && (
            <div
              className="ml-auto mt-2 w-[270px] text-right"
              style={{ fontSize: `${fsSmall}px`, ...estiloLimiteLinhasFaturaPreview() }}
            >
              {layout.totalServicos ? (
                <div className="grid grid-cols-[1fr_90px] border-b py-0.5" style={{ borderColor: "#000" }}>
                  <span>Total Serviços (+)</span>
                  <strong>{amostra.totalServicos}</strong>
                </div>
              ) : null}
              {layout.descontoServicos ? (
                <div className="grid grid-cols-[1fr_90px] border-b py-0.5" style={{ borderColor: "#000" }}>
                  <span>Desconto Serviços (-)</span>
                  <span>{amostra.descontoServicos}</span>
                </div>
              ) : null}
              {layout.descontoFatura ? (
                <div className="grid grid-cols-[1fr_90px] border-b py-0.5" style={{ borderColor: "#000" }}>
                  <span>Desconto Fatura (-)</span>
                  <span>{amostra.descontoFatura}</span>
                </div>
              ) : null}
              {layout.total ? (
                <div className="grid grid-cols-[1fr_90px] py-0.5 font-bold">
                  <span>Total (=)</span>
                  <strong>{amostra.total}</strong>
                </div>
              ) : null}
            </div>
          )}

          {layout.condicaoPagamento ? (
            <div
              className="mt-4"
              style={{ fontSize: `${fsSmall}px`, ...estiloLimiteLinhasFaturaPreview() }}
            >
              <p className="mb-1 font-bold">Condição de Pagamento</p>
              <table className="w-full border-collapse" style={estiloTabelaMargemFaturaPreview()}>
                <thead>
                  <tr style={estiloLinhaInferiorFaturaPreview()}>
                    <th className="py-0.5 text-left font-bold">Parcela</th>
                    <th className="py-0.5 text-left font-bold">Vencimento</th>
                    {layout.formaPgto ? <th className="py-0.5 text-left font-bold">Forma Pgto</th> : null}
                    <th className="py-0.5 text-left font-bold">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {amostra.parcelas.map((p) => (
                    <tr key={p.parcela} style={estiloLinhaInferiorFaturaPreview()}>
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
            <div
              className="mt-3"
              style={{ fontSize: `${fsSmall}px`, ...estiloLimiteLinhasFaturaPreview() }}
            >
              <p className="font-bold">Observação:</p>
              <p className="mt-1">{amostra.observacao}</p>
            </div>
          ) : null}

          {layout.mensagem ? (
            <p
              className="mt-3 text-center italic text-slate-600"
              style={{ fontSize: `${fsSmall}px`, ...estiloLimiteLinhasFaturaPreview() }}
            >
              {layout.mensagem}
            </p>
          ) : null}

          <div
            className="mt-6 flex items-end justify-between gap-4"
            style={{ fontSize: `${fsSmall}px`, ...estiloLimiteLinhasFaturaPreview() }}
          >
            {layout.pix ? (
              <div className="flex flex-col items-center">
                {layout.pixQrImagem?.startsWith("data:image") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={layout.pixQrImagem}
                    alt="QR Code PIX"
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
                <span className="mt-1" style={{ fontSize: `${layout.pixQrFonte}px` }}>
                  Pagar com PIX
                </span>
              </div>
            ) : (
              <div />
            )}
            {layout.assinatura ? (
              <div className="flex-1 text-center">
                <div className="mx-auto mb-1 w-48 border-t border-black" />
                <p>Recebi o(s) serviço(s) descritos acima</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
