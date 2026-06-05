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
  estiloLinhaDivisoriaCinzaFaturaPreview,
  estiloLinhaDivisoriaFaturaPreview,
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

const ESTILO_CELULA_SEM_BORDA = {
  border: "none" as const,
  borderTop: "none" as const,
  borderBottom: "none" as const,
};

function LinhaSeparador({ marginTop }: { marginTop?: string }) {
  return <div style={{ ...estiloLinhaDivisoriaFaturaPreview(), marginTop }} />;
}

function LinhaSeparadorCinza({ marginTop }: { marginTop?: string }) {
  return <div style={{ ...estiloLinhaDivisoriaCinzaFaturaPreview(), marginTop }} />;
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
  const colunasTabela = [
    layout.numOs,
    layout.qtd,
    layout.servico,
    layout.numDente,
    layout.paciente,
    layout.valorUnit,
    layout.desconto,
    layout.subtotal,
  ].filter(Boolean).length;
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

          {/* Bloco itens — Smart: linha em cima, dados sem borda interna, linha embaixo */}
          <div style={{ marginTop: "2mm", width: "100%" }}>
            <LinhaSeparador />
            <div style={{ ...estiloTabelaMargemFaturaPreview(), fontSize: `${fsSmall}px` }}>
              <table
                className="w-full"
                style={{ borderCollapse: "collapse", border: "none" }}
              >
                <thead>
                  <tr>
                    {layout.numOs ? (
                      <th className="py-0.5 pr-1 text-left font-bold" style={ESTILO_CELULA_SEM_BORDA}>
                        OS
                      </th>
                    ) : null}
                    {layout.qtd ? (
                      <th
                        className="py-0.5 pr-1 text-center font-bold"
                        style={ESTILO_CELULA_SEM_BORDA}
                      >
                        Qtd
                      </th>
                    ) : null}
                    {layout.servico ? (
                      <th className="py-0.5 pr-1 text-left font-bold" style={ESTILO_CELULA_SEM_BORDA}>
                        Serviços/Produtos
                      </th>
                    ) : null}
                    {layout.numDente ? (
                      <th className="px-1 py-0.5 text-left font-bold" style={ESTILO_CELULA_SEM_BORDA}>
                        Num Dente
                      </th>
                    ) : null}
                    {layout.paciente ? (
                      <th className="px-1 py-0.5 text-left font-bold" style={ESTILO_CELULA_SEM_BORDA}>
                        Paciente
                      </th>
                    ) : null}
                    {layout.valorUnit ? (
                      <th className="px-1 py-0.5 text-right font-bold" style={ESTILO_CELULA_SEM_BORDA}>
                        Unitário
                      </th>
                    ) : null}
                    {layout.desconto ? (
                      <th className="px-1 py-0.5 text-right font-bold" style={ESTILO_CELULA_SEM_BORDA}>
                        Desc
                      </th>
                    ) : null}
                    {layout.subtotal ? (
                      <th className="py-0.5 pl-1 text-right font-bold" style={ESTILO_CELULA_SEM_BORDA}>
                        Subtotal
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {amostra.linhas.map((linha) => (
                    <Fragment key={linha.os}>
                      <tr>
                        {layout.numOs ? (
                          <td
                            className="py-0.5 pr-1 align-top font-medium"
                            style={ESTILO_CELULA_SEM_BORDA}
                          >
                            {linha.os}
                          </td>
                        ) : null}
                        {layout.qtd ? (
                          <td
                            className="py-0.5 pr-1 text-center align-top"
                            style={ESTILO_CELULA_SEM_BORDA}
                          >
                            {linha.qtd}
                          </td>
                        ) : null}
                        {layout.servico ? (
                          <td className="py-0.5 pr-1 align-top" style={ESTILO_CELULA_SEM_BORDA}>
                            {linha.servico}
                          </td>
                        ) : null}
                        {layout.numDente ? (
                          <td className="px-1 py-0.5 align-top" style={ESTILO_CELULA_SEM_BORDA}>
                            {linha.dentes}
                          </td>
                        ) : null}
                        {layout.paciente ? (
                          <td className="px-1 py-0.5 align-top" style={ESTILO_CELULA_SEM_BORDA}>
                            {linha.paciente}
                          </td>
                        ) : null}
                        {layout.valorUnit ? (
                          <td className="px-1 py-0.5 text-right align-top" style={ESTILO_CELULA_SEM_BORDA}>
                            {linha.unitario}
                          </td>
                        ) : null}
                        {layout.desconto ? (
                          <td className="px-1 py-0.5 text-right align-top" style={ESTILO_CELULA_SEM_BORDA}>
                            {linha.desconto}
                          </td>
                        ) : null}
                        {layout.subtotal ? (
                          <td className="py-0.5 pl-1 text-right align-top" style={ESTILO_CELULA_SEM_BORDA}>
                            {linha.subtotal}
                          </td>
                        ) : null}
                      </tr>
                      {exibirMetaLinha ? (
                        <tr>
                          <td
                            colSpan={colunasTabela}
                            className="pb-0.5 pt-0 text-slate-900"
                            style={{ ...ESTILO_CELULA_SEM_BORDA, fontSize: `${fsMetaLinha}px` }}
                          >
                            {layout.data ? (
                              <span className="mr-3">
                                <span>Data: </span>
                                <span className="font-bold">{linha.dataOs}</span>
                              </span>
                            ) : null}
                            {layout.finalizado ? (
                              <span className="mr-3">
                                <span>Finalizado: </span>
                                <span className="font-bold">{linha.finalizado}</span>
                              </span>
                            ) : null}
                            {layout.osExterna ? (
                              <span className="mr-3">
                                <span>OS Externa: </span>
                                <span className="font-bold">{linha.osExterna}</span>
                              </span>
                            ) : null}
                            {layout.corDente ? (
                              <span>
                                <span>Cor: </span>
                                <span className="font-bold">{linha.cor}</span>
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
            <LinhaSeparador />
          </div>

          {(layout.totalServicos ||
            layout.descontoServicos ||
            layout.descontoFatura ||
            layout.total) && (
            <>
              <div
                className="ml-auto mt-2 w-[270px] text-right"
                style={{ fontSize: `${fsSmall}px` }}
              >
                {layout.totalServicos ? (
                  <div className="grid grid-cols-[1fr_90px] py-0.5">
                    <span>Total Serviços (=)</span>
                    <strong>{amostra.totalServicos}</strong>
                  </div>
                ) : null}
                {layout.descontoServicos ? (
                  <div className="grid grid-cols-[1fr_90px] py-0.5">
                    <span>Desconto Serviços (-)</span>
                    <span>{amostra.descontoServicos}</span>
                  </div>
                ) : null}
                {layout.descontoFatura ? (
                  <div className="grid grid-cols-[1fr_90px] py-0.5">
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
              <LinhaSeparadorCinza marginTop="2mm" />
            </>
          )}

          {layout.condicaoPagamento ? (
            <>
              <div
                className="mt-2"
                style={{ fontSize: `${fsSmall}px` }}
              >
                <p className="mb-1 font-bold">Condição de Pagamento</p>
                <table
                  className="w-full"
                  style={{ borderCollapse: "collapse", ...estiloTabelaMargemFaturaPreview() }}
                >
                  <thead>
                    <tr>
                      <th className="py-0.5 text-left font-bold" style={ESTILO_CELULA_SEM_BORDA}>
                        Parcela
                      </th>
                      <th className="py-0.5 text-left font-bold" style={ESTILO_CELULA_SEM_BORDA}>
                        Vencimento
                      </th>
                      {layout.formaPgto ? (
                        <th className="py-0.5 text-left font-bold" style={ESTILO_CELULA_SEM_BORDA}>
                          Forma Pgto
                        </th>
                      ) : null}
                      <th className="py-0.5 text-left font-bold" style={ESTILO_CELULA_SEM_BORDA}>
                        Valor
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {amostra.parcelas.map((p) => (
                      <tr key={p.parcela}>
                        <td className="py-0.5" style={ESTILO_CELULA_SEM_BORDA}>
                          {p.parcela}
                        </td>
                        <td className="py-0.5" style={ESTILO_CELULA_SEM_BORDA}>
                          {p.vencimento}
                        </td>
                        {layout.formaPgto ? (
                          <td className="py-0.5" style={ESTILO_CELULA_SEM_BORDA}>
                            {p.forma}
                          </td>
                        ) : null}
                        <td className="py-0.5" style={ESTILO_CELULA_SEM_BORDA}>
                          {p.valor}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <LinhaSeparadorCinza marginTop="2mm" />
            </>
          ) : null}

          {layout.observacao ? (
            <div
              className="mt-2"
              style={{ fontSize: `${fsSmall}px` }}
            >
              <p>
                <span className="font-bold">Observação: </span>
                {amostra.observacao}
              </p>
            </div>
          ) : null}

          {layout.mensagem ? (
            <p
              className="mt-3 text-center italic text-slate-600"
              style={{ fontSize: `${fsSmall}px` }}
            >
              {layout.mensagem}
            </p>
          ) : null}

          <div
            className="mt-4 flex items-center justify-between gap-4"
            style={{ fontSize: `${fsSmall}px` }}
          >
            {layout.pix ? (
              <div className="flex items-center gap-3">
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
                <span style={{ fontSize: `${layout.pixQrFonte}px` }}>Pagar com PIX</span>
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

          <LinhaSeparadorCinza marginTop="3mm" />
        </div>
      </div>
    </div>
  );
}
