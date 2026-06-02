"use client";

import { FileText } from "lucide-react";
import { Button } from "@/components/ui";
import { parseParcelaNaDescricao } from "@/lib/fatura-financeiro";
import {
  desempacotarDespesa,
  type AnexoDespesa,
  type EntidadeDespesa,
} from "@/lib/lancamento-despesa";
import { formatDate } from "@/lib/utils";

export type LancamentoDespesaDetalhe = {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  status: string;
  formaPagamento?: string | null;
  cliente?: { nome?: string } | null;
  trabalho?: { numeroOs?: number } | null;
};

const ROTULO_ENTIDADE: Record<EntidadeDespesa, string> = {
  todos: "Tipo",
  fornecedores: "Fornecedor",
  colaboradores: "Colaborador",
  prestadores: "Prestador",
  entregadores: "Entregador",
  clientes: "Cliente",
};

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function rotuloStatus(status: string) {
  if (status === "pago") return "Pago";
  if (status === "cancelado") return "Cancelado";
  return "A pagar";
}

function descricaoSemParcela(texto: string) {
  const parcela = parseParcelaNaDescricao(texto);
  if (!parcela) return texto.trim();
  return texto.replace(/\(\d+\s*\/\s*\d+\)\s*$/, "").trim();
}

function Detail({
  label,
  value,
  emptyValue = "—",
}: {
  label: string;
  value: string;
  emptyValue?: string;
}) {
  const exibir = value?.trim() ? value : emptyValue;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800">{exibir}</p>
    </div>
  );
}

type Props = {
  lancamento: LancamentoDespesaDetalhe;
  refOs?: string;
  onEditar: () => void;
  onAnexoClick: (anexo: AnexoDespesa) => void;
};

export function DespesaDetalheExpandido({
  lancamento,
  refOs,
  onEditar,
  onAnexoClick,
}: Props) {
  const pack = desempacotarDespesa(lancamento.descricao);
  const textoBase = descricaoSemParcela(pack.texto);
  const partesDescricao = textoBase.split("|").map((p) => p.trim()).filter(Boolean);
  const itens = partesDescricao.length > 1 ? partesDescricao.slice(0, -1) : partesDescricao;
  const observacoes =
    partesDescricao.length > 1 ? partesDescricao[partesDescricao.length - 1] : "";
  const entidade = pack.meta.entidade || "fornecedores";
  const referencia =
    refOs ||
    (pack.referencia !== "—"
      ? pack.referencia
      : lancamento.trabalho?.numeroOs != null
        ? `OS ${lancamento.trabalho.numeroOs}`
        : "—");
  const anexos = pack.meta.anexos ?? [];
  const nomeExibicao = lancamento.cliente?.nome?.trim() || pack.nome;
  const itensTexto = itens.join("; ") || "—";

  return (
    <div className="text-left">
      {anexos.length > 0 ? (
        <div className="mb-3">
          <p className="mb-2 text-xs font-semibold text-slate-600">Imagens:</p>
          <div className="flex flex-wrap gap-2">
            {anexos.map((anexo) => {
              const isPdf =
                anexo.type === "application/pdf" ||
                anexo.name.toLowerCase().endsWith(".pdf");
              return (
                <button
                  type="button"
                  key={anexo.url}
                  onClick={() => onAnexoClick(anexo)}
                  className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm hover:border-[#4a90d9]"
                  title={anexo.name}
                >
                  {isPdf ? (
                    <div className="flex h-16 w-24 flex-col items-center justify-center gap-0.5 bg-slate-50 text-[#4a90d9]">
                      <FileText className="h-6 w-6" />
                      <span className="text-[9px] font-medium uppercase">PDF</span>
                    </div>
                  ) : (
                    <img
                      src={anexo.url}
                      alt={anexo.name}
                      className="h-16 w-24 object-cover"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="mb-3 text-xs text-slate-400">Nenhum comprovante anexado.</p>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <Detail label="Vencimento" value={formatDate(lancamento.data)} />
        <Detail label="Parcela" value={pack.parcela} />
        <Detail label={ROTULO_ENTIDADE[entidade]} value={nomeExibicao} />
        <Detail label="Referência" value={referencia} />
        <Detail label="Categoria" value={pack.categoria} />
        <Detail label="Conta bancária" value={pack.conta} />
        <Detail label="Forma de pagamento" value={lancamento.formaPagamento || ""} />
        <Detail label="Situação" value={rotuloStatus(lancamento.status)} />
        <Detail label="Valor" value={`R$ ${money(lancamento.valor)}`} />
        <Detail label="Itens / descrição" value={itensTexto} emptyValue="—" />
        <Detail
          label="Observações"
          value={observacoes && observacoes !== itens[0] ? observacoes : ""}
          emptyValue="—"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" type="button" onClick={onEditar}>
          Editar despesa
        </Button>
        <button
          type="button"
          onClick={onEditar}
          className="rounded border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
        >
          + Adicionar comprovante
        </button>
      </div>
    </div>
  );
}
