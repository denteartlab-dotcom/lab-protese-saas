"use client";

import { useMemo } from "react";
import { Code39Barcode } from "@/lib/code39-barcode";
import {
  montarTextosCabecalhoRequisicao,
  normalizarCabecalhoRequisicao,
} from "@/lib/cabecalho-requisicao";
import type { ConfigLaboratorio } from "@/lib/configuracoes-lab";
import { configParaLabImpressao, escalaLogoMultiplicador } from "@/lib/lab-logo";
import {
  estiloBordaRequisicaoPreview,
  estiloLinhaInferiorRequisicaoPreview,
  estiloLinhaRequisicaoPreview,
  normalizarCorBorda,
  OS_MODELO1_BORDA_MARGEM_MM,
  type OsModelo1Layout,
} from "@/lib/os-modelo1-layout";
import { PREVIEW_OS_MODELO3 } from "@/lib/os-modelo3-layout";
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
    <div className={cn(className)} style={estiloLinhaRequisicaoPreview(cor)} />
  );
}

export function PreviewOsModeloComprovante({
  cfg,
  layout,
}: {
  cfg: ConfigLaboratorio;
  layout: OsModelo1Layout;
}) {
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
  const corBorda = normalizarCorBorda(layout.bordas);
  const comBorda = layout.exibirBordas;
  const corLinha = corBorda;

  const money = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const totalServicos = amostra.totalServicos;
  const totalDescontos = amostra.totalDescontos;
  const totalFinal = amostra.total;

  return (
    <div
      className="mx-auto box-border bg-white text-slate-900 shadow-md"
      style={{
        width: "210mm",
        minHeight: "297mm",
        maxWidth: "100%",
        padding: `${OS_MODELO1_BORDA_MARGEM_MM}mm`,
        fontSize: `${fs}px`,
        fontFamily: "Arial, Helvetica, sans-serif",
        boxSizing: "border-box",
      }}
    >
      <div
        className="box-border w-full"
        style={comBorda ? estiloBordaRequisicaoPreview(corBorda) : { padding: 0 }}
      >
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
            <p className="font-normal">Ordem de Serviço</p>
            <p className="font-bold leading-none" style={{ fontSize: `${fs + 10}px` }}>
              {amostra.numeroOs}
            </p>
            {layout.dataOs ? (
              <p className="mt-1">
                <span className="font-bold">Data: </span>
                {amostra.dataEntrada}
              </p>
            ) : null}
            {layout.usuario ? (
              <p>
                <span className="font-bold">Usuário: </span>
                {amostra.usuario}
              </p>
            ) : null}
          </div>
        </div>

        <LinhaSeparador cor={corLinha} className="mt-3" />

        <div
          className="mt-2.5 grid grid-cols-2 gap-x-8 gap-y-0.5"
          style={{ fontSize: `${fsSmall}px` }}
        >
          <div className="space-y-0.5">
            {layout.numOs ? (
              <LinhaRotuloValor rotulo="Num. OS:" valor={String(amostra.numeroOs)} />
            ) : null}
            {layout.cliente ? (
              <LinhaRotuloValor rotulo="Cliente:" valor={amostra.cliente} />
            ) : null}
            {layout.dentista ? (
              <LinhaRotuloValor rotulo="Dentista:" valor={amostra.dentista} />
            ) : null}
            {layout.paciente ? (
              <LinhaRotuloValor rotulo="Paciente:" valor={amostra.paciente} />
            ) : null}
          </div>
          <div className="space-y-0.5">
            {layout.osExterna ? (
              <LinhaRotuloValor rotulo="OS Externa:" valor={amostra.osExterna} />
            ) : null}
            {layout.caixa ? <LinhaRotuloValor rotulo="Caixa:" valor={amostra.caixa} /> : null}
            {layout.clienteTel ? (
              <LinhaRotuloValor rotulo="Telefones:" valor={amostra.telefones} />
            ) : null}
            {layout.clienteEmail ? (
              <LinhaRotuloValor rotulo="Email:" valor={amostra.email} />
            ) : null}
            {layout.clienteEnd ? (
              <LinhaRotuloValor rotulo="Endereço:" valor={amostra.endereco} />
            ) : null}
          </div>
        </div>

        <LinhaSeparador cor={corLinha} className="mt-2.5" />

        <table
          className="mt-2 w-full border-collapse"
          style={{ fontSize: `${fsSmall}px` }}
        >
          <thead>
            <tr style={estiloLinhaInferiorRequisicaoPreview(corLinha)}>
              <th className="py-1 pr-2 text-left font-bold">Qtd</th>
              <th className="py-1 pr-2 text-left font-bold">Descrição</th>
              {layout.numDente ? (
                <th className="py-1 px-1 text-center font-bold">Número Dente</th>
              ) : null}
              {layout.corDente ? <th className="py-1 px-1 text-center font-bold">Cor</th> : null}
              {layout.valorUnit ? (
                <th className="py-1 px-1 text-right font-bold">Unitário</th>
              ) : null}
              {layout.desconto ? <th className="py-1 pl-1 text-right font-bold">Desc</th> : null}
              {layout.subtotal ? (
                <th className="py-1 pl-1 text-right font-bold">Subtotal</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {amostra.itens.map((item, indice) => (
              <tr
                key={item.descricao}
                style={
                  indice < amostra.itens.length - 1 || !layout.total
                    ? estiloLinhaInferiorRequisicaoPreview(corLinha)
                    : undefined
                }
              >
                <td className="py-1.5 pr-2 align-top">{item.qtd}</td>
                <td className="py-1.5 pr-2 align-top">
                  <div>{item.descricao}</div>
                  {indice === 0 ? (
                    <p className="mt-0.5 text-[11px]">
                      <span>Prazo: Produção: </span>
                      <span className="font-bold">{amostra.prazo}</span>
                    </p>
                  ) : null}
                </td>
                {layout.numDente ? (
                  <td className="px-1 py-1.5 text-center align-top">{item.dente}</td>
                ) : null}
                {layout.corDente ? (
                  <td className="px-1 py-1.5 text-center align-top">{item.cor}</td>
                ) : null}
                {layout.valorUnit ? (
                  <td className="px-1 py-1.5 text-right align-top">{money(item.unitario)}</td>
                ) : null}
                {layout.desconto ? (
                  <td className="py-1.5 pl-1 text-right align-top">{item.desconto}</td>
                ) : null}
                {layout.subtotal ? (
                  <td className="py-1.5 pl-1 text-right align-top">{money(item.subtotal)}</td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-2 space-y-0.5" style={{ fontSize: `${fsSmall}px` }}>
          {layout.finalizado ? (
            <p>
              <span>Finalizado: </span>
              <span className="font-bold">{amostra.finalizado}</span>
            </p>
          ) : null}
          {layout.colaborador ? (
            <p>
              <span>Colaborador: </span>
              <span className="font-bold">{amostra.colaborador}</span>
            </p>
          ) : null}
          {layout.produtos && amostra.produtos ? (
            <p>
              <span>Produtos: </span>
              <span className="font-bold">{amostra.produtos}</span>
            </p>
          ) : null}
          {layout.producao ? (
            <p>
              <span>Produção: </span>
              <span className="font-bold">Em produção</span>
            </p>
          ) : null}
          {layout.etapas ? (
            <p>
              <span>Etapas: </span>
              <span className="font-bold">{amostra.etapas}</span>
            </p>
          ) : null}
        </div>

        {layout.total ? (
          <>
            <LinhaSeparador cor={corLinha} className="mt-2" />
            <div className="mt-1.5 space-y-0.5 text-right" style={{ fontSize: `${fsSmall}px` }}>
              <p>
                <span className="font-bold">Total Serviços </span>
                {money(totalServicos)}
              </p>
              <p>
                <span className="font-bold">(-) Descontos </span>
                {money(totalDescontos)}
              </p>
              <p>
                <span className="font-bold">(=) Total </span>
                {money(totalFinal)}
              </p>
            </div>
          </>
        ) : null}

        {layout.materialRec ? (
          <p className="mt-2" style={{ fontSize: `${fsSmall}px` }}>
            <span>Materiais: </span>
            <span className="font-bold">{amostra.materiais}</span>
          </p>
        ) : null}

        {layout.obsFicha ? (
          <p className="mt-2" style={{ fontSize: `${fsSmall}px` }}>
            <span>Observação: </span>
            <span className="font-bold">{amostra.obsFicha}</span>
          </p>
        ) : null}

        {layout.mensagem.trim() ? (
          <p className="mt-2 italic text-slate-700" style={{ fontSize: `${fsSmall}px` }}>
            {layout.mensagem}
          </p>
        ) : null}

        {layout.assinatura ? (
          <div className="mt-10 text-center" style={{ fontSize: `${fsSmall - 1}px` }}>
            <div className="mx-auto w-56" style={estiloLinhaRequisicaoPreview(corLinha)} />
            <p className="mt-1 text-slate-800">Recebi o(s) serviço(s) descritos acima</p>
          </div>
        ) : null}

        {layout.codBarras ? (
          <div className="mt-6">
            <Code39Barcode value={`OS${amostra.numeroOs}`} height={36} />
            <p className="mt-0.5 font-mono text-[9px] tracking-wide text-slate-800">
              OS{amostra.numeroOs}
            </p>
            <LinhaSeparador cor={corLinha} className="mt-2" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
