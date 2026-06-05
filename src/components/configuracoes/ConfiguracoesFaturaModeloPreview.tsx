"use client";

import {
  nomeExibicaoLaboratorio,
  type ConfigLaboratorio,
} from "@/lib/configuracoes-lab";
import {
  PREVIEW_FATURA_AMOSTRA,
  type FaturaModeloLayout,
} from "@/lib/fatura-modelo-layout";
import { configParaLabImpressao, dimensoesLogoPx } from "@/lib/lab-logo";
import { cn } from "@/lib/utils";

type Props = {
  cfg: ConfigLaboratorio;
  layout: FaturaModeloLayout;
  termica?: boolean;
};

export function ConfiguracoesFaturaModeloPreview({ cfg, layout, termica }: Props) {
  const lab = configParaLabImpressao(cfg);
  const amostra = PREVIEW_FATURA_AMOSTRA;
  const logo = dimensoesLogoPx(lab, {
    largura: layout.logoTamanhoPx,
    altura: layout.logoTamanhoPx,
  });
  const corBorda = layout.bordas || "#111";
  const fs = layout.tamanhoFonte;

  const pageStyle = termica
    ? { width: "226px", fontSize: `${Math.max(8, fs - 1)}px` }
    : {
        width: "760px",
        fontSize: `${fs}px`,
        padding: `${layout.margemSuperior}mm ${layout.margemDireita}mm ${layout.margemInferior}mm ${layout.margemEsquerda}mm`,
      };

  return (
    <div className="mx-auto flex justify-center">
      <div
        className={cn(
          "bg-white text-[#111] shadow-lg",
          layout.exibirBordas && "border border-[#ccc]"
        )}
        style={pageStyle}
      >
        <div
          className={cn(
            "grid items-center gap-4",
            termica ? "grid-cols-1 px-2 py-2" : "grid-cols-[118px_1fr_150px] px-6 py-5"
          )}
        >
          {layout.logo && lab.logoDataUrl ? (
            <div style={{ marginLeft: layout.logoMargemEsq, marginTop: layout.logoMargemTopo }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lab.logoDataUrl} alt="" width={logo.largura} height={logo.altura} />
            </div>
          ) : layout.logo ? (
            <div className="text-[10px] text-slate-400">Logo</div>
          ) : null}

          {layout.infoLab ? (
            <div className="leading-tight">
              <strong className="block text-[18px]">{nomeExibicaoLaboratorio(cfg)}</strong>
              <span className="text-[12px] text-slate-700">{cfg.endereco || "Endereço do lab"}</span>
            </div>
          ) : (
            <div />
          )}

          {(layout.numFatura || layout.dataFatura) && (
            <div className="text-center leading-tight">
              {layout.numFatura ? (
                <>
                  <span className="block text-[18px]">Fatura</span>
                  <strong className="block text-[22px]">{amostra.numFatura}</strong>
                </>
              ) : null}
              {layout.dataFatura ? (
                <span className="mt-2 block text-[8px]">Data: {amostra.data}</span>
              ) : null}
            </div>
          )}
        </div>

        <div className="mx-6 border-t-2" style={{ borderColor: corBorda }} />

        <div className="mx-6 grid grid-cols-2 gap-2 border-b py-2 text-[11px]" style={{ borderColor: corBorda }}>
          <div>
            {layout.cliente ? (
              <p>
                <strong>Cliente:</strong> {amostra.cliente}
              </p>
            ) : null}
            {layout.telefones ? (
              <p>
                <strong>Telefones:</strong> {amostra.telefones}
              </p>
            ) : null}
            {layout.saldoAnterior ? (
              <p>
                <strong>Saldo Anterior:</strong> 0,00
              </p>
            ) : null}
          </div>
          <div>
            {layout.email ? (
              <p>
                <strong>Email:</strong> {amostra.email}
              </p>
            ) : null}
            {layout.endereco ? (
              <p>
                <strong>Endereço:</strong> {amostra.endereco}
              </p>
            ) : null}
          </div>
        </div>

        <table className="mx-6 w-[calc(100%-3rem)] border-collapse text-[9px]">
          <thead>
            <tr className="border-b font-bold" style={{ borderColor: corBorda }}>
              {layout.os ? <th className="px-1 py-1 text-left">Os</th> : null}
              {layout.servico ? <th className="px-1 py-1 text-left">Serviço/Produtos</th> : null}
              {layout.dentes ? <th className="px-1 py-1 text-left">Número Dente</th> : null}
              {layout.paciente ? <th className="px-1 py-1 text-left">Paciente</th> : null}
              {layout.qtd ? <th className="px-1 py-1 text-center">Qtd</th> : null}
              {layout.unitario ? <th className="px-1 py-1 text-right">Unitário</th> : null}
              {layout.desconto ? <th className="px-1 py-1 text-right">Desc</th> : null}
              {layout.subtotal ? <th className="px-1 py-1 text-right">Subtotal</th> : null}
            </tr>
          </thead>
          <tbody>
            {amostra.linhas.map((linha, i) => (
              <tr key={i} className="border-b" style={{ borderColor: corBorda }}>
                {layout.os ? (
                  <td className="px-1 py-1 align-top">
                    {linha.os}
                    <br />
                    <span className="text-[8px]">Data: {linha.dataOs}</span>
                  </td>
                ) : null}
                {layout.servico ? <td className="px-1 py-1">{linha.servico}</td> : null}
                {layout.dentes ? <td className="px-1 py-1">{linha.dentes}</td> : null}
                {layout.paciente ? <td className="px-1 py-1">{linha.paciente}</td> : null}
                {layout.qtd ? <td className="px-1 py-1 text-center">{linha.qtd}</td> : null}
                {layout.unitario ? <td className="px-1 py-1 text-right">{linha.unitario}</td> : null}
                {layout.desconto ? <td className="px-1 py-1 text-right">{linha.desconto}</td> : null}
                {layout.subtotal ? <td className="px-1 py-1 text-right">{linha.subtotal}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mx-6 ml-auto mt-2 w-[270px] border-t text-[10px]" style={{ borderColor: corBorda }}>
          {layout.totalServicos ? (
            <div className="grid grid-cols-[1fr_86px] py-0.5">
              <span>Total Serviços / Produtos (=)</span>
              <strong className="text-right">{amostra.totalServicos}</strong>
            </div>
          ) : null}
          {layout.descontoServicos ? (
            <div className="grid grid-cols-[1fr_86px] py-0.5">
              <span>Desconto Serviços (-)</span>
              <span className="text-right">{amostra.descontoServicos}</span>
            </div>
          ) : null}
          {layout.descontoFatura ? (
            <div className="grid grid-cols-[1fr_86px] py-0.5">
              <span>Desconto Fatura (-)</span>
              <span className="text-right">{amostra.descontoFatura}</span>
            </div>
          ) : null}
          {layout.jurosFatura ? (
            <div className="grid grid-cols-[1fr_86px] py-0.5">
              <span>Juros Fatura (+)</span>
              <span className="text-right">{amostra.jurosFatura}</span>
            </div>
          ) : null}
          {layout.total ? (
            <div className="grid grid-cols-[1fr_86px] py-0.5 font-bold">
              <span>Total (=)</span>
              <strong className="text-right">{amostra.total}</strong>
            </div>
          ) : null}
        </div>

        {layout.condicaoPagamento ? (
          <div className="mx-6 mt-4 border-t pt-2 text-[10px]" style={{ borderColor: corBorda }}>
            <p className="mb-1 font-bold">Condição de Pagamento</p>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="px-1 py-1 text-left">Parcela</th>
                  <th className="px-1 py-1 text-left">Vencimento</th>
                  <th className="px-1 py-1 text-left">Forma Pgto</th>
                  <th className="px-1 py-1 text-left">Valor</th>
                  <th className="px-1 py-1 text-left">Pago</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-1 py-1">{amostra.parcela}</td>
                  <td className="px-1 py-1">{amostra.vencimento}</td>
                  <td className="px-1 py-1">{amostra.formaPagamento}</td>
                  <td className="px-1 py-1">{amostra.valorParcela}</td>
                  <td className="px-1 py-1">{amostra.pago}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}

        {layout.observacao ? (
          <div className="mx-6 mt-3 border-t pt-2 text-[10px] text-slate-600">Observação:</div>
        ) : null}
      </div>
    </div>
  );
}

