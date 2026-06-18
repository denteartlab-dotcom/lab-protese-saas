"use client";

import { useMemo } from "react";
import { Code39Barcode } from "@/lib/code39-barcode";
import { configParaLabImpressao } from "@/lib/lab-logo";
import type { ConfigLaboratorio } from "@/lib/configuracoes-lab";
import { nomeUsuarioDocumentosLaboratorio } from "@/lib/configuracoes-lab";
import { normalizarCorBorda } from "@/lib/os-modelo1-layout";
import { PREVIEW_OS_MODELO4, type OsModelo4Layout } from "@/lib/os-modelo4-layout";
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

/** Preview térmica 80mm — Modelo 4 (Smart / Epson T20). */
export function PreviewOsModelo4Termica({
  cfg,
  layout,
}: {
  cfg: ConfigLaboratorio;
  layout: OsModelo4Layout;
}) {
  const lab = useMemo(() => configParaLabImpressao(cfg), [cfg]);
  const amostra = PREVIEW_OS_MODELO4;
  const fs = layout.tamanhoFonte;
  const fsSmall = Math.max(9, fs - 2);
  const corLinha = normalizarCorBorda(layout.bordas);
  const logoPx = layout.logoTamanhoPx;
  const logoMargemEsq = layout.logoMargemEsq;
  const logoMargemTopo = layout.logoMargemTopo;

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
      {layout.dataOs ? (
        <p className="text-right leading-none" style={{ fontSize: `${fsSmall}px` }}>
          {amostra.dataEntrada}
        </p>
      ) : null}

      {layout.logo ? (
        <div
          className="flex justify-center"
          style={{
            marginTop: logoMargemTopo,
            marginLeft: logoMargemEsq,
          }}
        >
          {cfg.logoDataUrl?.startsWith("data:image") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cfg.logoDataUrl}
              alt="Logo"
              style={{
                width: logoPx,
                height: Math.round(logoPx * 0.85),
                objectFit: "contain",
              }}
            />
          ) : (
            <div
              className="flex items-center justify-center bg-slate-200 text-slate-500"
              style={{ width: logoPx, height: Math.round(logoPx * 0.85), fontSize: 10 }}
            >
              Logo
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
        {layout.numOs ? (
          <LinhaRotuloValor rotulo="Num OS:" valor={String(amostra.numeroOs)} />
        ) : null}
        {layout.osExterna ? (
          <LinhaRotuloValor rotulo="OS Externa:" valor={amostra.osExterna} />
        ) : null}
        {layout.caixa ? <LinhaRotuloValor rotulo="Caixa:" valor={amostra.caixa} /> : null}
        {layout.cliente ? (
          <LinhaRotuloValor rotulo="Cliente:" valor={amostra.cliente} />
        ) : null}
        {layout.dentista ? (
          <LinhaRotuloValor rotulo="Dentista:" valor={amostra.dentista} />
        ) : null}
        {layout.paciente ? (
          <LinhaRotuloValor rotulo="Paciente:" valor={amostra.paciente} />
        ) : null}
        {layout.clienteTel ? (
          <LinhaRotuloValor rotulo="Telefones:" valor={amostra.telefones} />
        ) : null}
        {layout.clienteEmail ? (
          <LinhaRotuloValor rotulo="Email:" valor={amostra.email} />
        ) : null}
        {layout.clienteEnd ? (
          <LinhaRotuloValor rotulo="Endereço:" valor={amostra.endereco} />
        ) : null}
        {layout.chavePed ? (
          <LinhaRotuloValor rotulo="Chave Ped:" valor={amostra.chavePed} />
        ) : null}
        {layout.usuario ? (
          <LinhaRotuloValor rotulo="Usuário:" valor={nomeUsuarioDocumentosLaboratorio(cfg)} />
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
                <th className="w-6 py-0.5 text-left font-bold">Qtd</th>
                <th className="py-0.5 pr-1 text-left font-bold">Descrição</th>
                {layout.valorUnit ? (
                  <th className="w-[4.2rem] py-0.5 text-right font-bold">Unitário</th>
                ) : null}
                {layout.desconto ? (
                  <th className="w-[3.2rem] py-0.5 text-right font-bold">Descontos</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {amostra.itens.map((row) => (
                <tr key={row.descricao}>
                  <td className="align-top font-bold">{row.qtd}</td>
                  <td className="align-top pr-1">
                    <span>{row.descricao}</span>
                    <div className="mt-1 space-y-0.5 font-normal">
                      {layout.numDente ? (
                        <p>
                          <span>Num Dente: </span>
                          <span className="font-bold">{row.dente}</span>
                        </p>
                      ) : null}
                      {layout.corDente ? (
                        <p>
                          <span>Cor Dente: </span>
                          <span className="font-bold">{row.cor}</span>
                        </p>
                      ) : null}
                      {layout.dataPrazo || layout.finalizado ? (
                        <p>
                          {layout.dataPrazo ? (
                            <>
                              <span>Prazo: </span>
                              <span className="font-bold">{amostra.prazo}</span>
                            </>
                          ) : null}
                          {layout.dataPrazo && layout.finalizado ? " " : null}
                          {layout.finalizado ? (
                            <>
                              <span>Finalizado: </span>
                              <span className="font-bold">{amostra.finalizado}</span>
                            </>
                          ) : null}
                        </p>
                      ) : null}
                      {layout.colaborador ? (
                        <p>
                          <span>Colaborador: </span>
                          <span className="font-bold">{amostra.colaborador}</span>
                        </p>
                      ) : null}
                    </div>
                  </td>
                  {layout.valorUnit ? (
                    <td className="align-top text-right font-normal">
                      {money(row.unitario)}
                    </td>
                  ) : null}
                  {layout.desconto ? (
                    <td className="align-top text-right font-normal">{row.desconto}</td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
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
              <span className="font-bold">Subtotal: </span>
              {money(amostra.total)}
            </p>
          ) : null}
          <p>
            <span className="font-bold">Total Serviços: </span>
            {money(amostra.totalServicos)}
          </p>
          {layout.desconto ? (
            <p>
              <span className="font-bold">(-) Descontos: </span>
              {money(amostra.totalDescontos)}
            </p>
          ) : null}
          {layout.total ? (
            <p className="font-bold">
              <span>(=) Total: </span>
              {money(amostra.total)}
            </p>
          ) : null}
        </div>
      ) : null}

      {layout.materialRec ? (
        <p className="mt-2" style={{ fontSize: `${fsSmall}px` }}>
          <span>Materiais: </span>
          <span className="font-bold">{amostra.materiais}</span>
        </p>
      ) : null}

      {layout.obsFicha ? (
        <p className="mt-1.5" style={{ fontSize: `${fsSmall}px` }}>
          <span>Observação: </span>
          <span className="font-bold">{amostra.obsFicha}</span>
        </p>
      ) : null}

      {layout.assinatura ? (
        <div className="mt-6 text-center" style={{ fontSize: `${fsSmall - 1}px` }}>
          <div className="mx-auto w-48 border-t" style={{ borderColor: corLinha }} />
          <p className="mt-1.5 lowercase text-slate-800">
            recebi o(s) serviço(s) descrito acima
          </p>
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
        <p>email: {lab.email}</p>
      </div>

      {layout.codBarras ? (
        <div className="mt-4 flex flex-col items-center">
          <Code39Barcode value={`OS${amostra.numeroOs}`} height={32} />
        </div>
      ) : null}
    </div>
  );
}
