"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  agruparPlanoContas,
  carregarPlanoContas,
  contaCriadaPeloUsuario,
  filtrarPorSecao,
  inserirContaPlano,
  profundidadeRelativaAoGrupo,
  PLANO_CONTAS_PADRAO,
  removerContaPlano,
  salvarPlanoContas,
  type ItemPlanoContas,
  type SecaoPlanoContas,
} from "@/lib/plano-contas";
import { fetchPainelFinanceiro } from "@/lib/financeiro-painel-cliente";
import type { PainelFinanceiroPlanoContas } from "@/lib/financeiro-painel-types";
import { ConfirmacaoExclusaoModal } from "@/components/ConfirmacaoExclusaoModal";
import { PlanoContasCadastroModal } from "@/components/financeiro/PlanoContasCadastroModal";

const AZUL_TITULO = "#7eb6ff";

function BotaoMais({
  item,
  onAdicionarFilho,
}: {
  item: ItemPlanoContas;
  onAdicionarFilho: (item: ItemPlanoContas) => void;
}) {
  return (
    <button
      type="button"
      title="Adicionar subconta"
      onClick={() => onAdicionarFilho(item)}
      className="shrink-0 border-0 bg-transparent p-0 text-[20px] font-normal leading-none text-sky-400 hover:text-sky-300"
      aria-label="Adicionar subconta"
    >
      +
    </button>
  );
}

function BotaoExcluir({
  item,
  onExcluir,
}: {
  item: ItemPlanoContas;
  onExcluir: (item: ItemPlanoContas) => void;
}) {
  return (
    <button
      type="button"
      title="Excluir conta"
      onClick={() => onExcluir(item)}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border-0 bg-transparent text-red-400 hover:bg-red-950/60 hover:text-red-300"
      aria-label="Excluir conta"
    >
      <Trash2 className="h-4 w-4" strokeWidth={2} />
    </button>
  );
}

function LinhaSubconta({
  item,
  topico,
  comBordaInferior,
  indice,
  onAdicionarFilho,
  onExcluir,
  mostrarMais = true,
}: {
  item: ItemPlanoContas;
  topico: ItemPlanoContas;
  comBordaInferior: boolean;
  indice: number;
  onAdicionarFilho: (item: ItemPlanoContas) => void;
  onExcluir: (item: ItemPlanoContas) => void;
  mostrarMais?: boolean;
}) {
  const podeExcluir = contaCriadaPeloUsuario(item);
  const profundidade = profundidadeRelativaAoGrupo(item, topico);
  const recuo =
    profundidade <= 1 ? "pl-4" : profundidade === 2 ? "pl-8" : "pl-12";

  return (
    <div
      className={`flex min-h-[44px] items-center justify-between gap-4 px-4 py-[13px] ${
        indice % 2 === 0 ? "bg-slate-800/90" : "bg-slate-700/80"
      } ${comBordaInferior ? "border-b border-slate-600/70" : ""}`}
    >
      <span className={`text-[13px] leading-snug text-slate-100 ${recuo}`}>
        <span className="font-medium text-sky-300/90">{item.codigo}</span>{" "}
        {item.nome}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        {podeExcluir ? (
          <BotaoExcluir item={item} onExcluir={onExcluir} />
        ) : null}
        {mostrarMais ? (
          <BotaoMais item={item} onAdicionarFilho={onAdicionarFilho} />
        ) : null}
      </div>
    </div>
  );
}

function GrupoPlano({
  topico,
  filhos,
  onAdicionarFilho,
  onExcluir,
  mostrarMaisNasLinhas = true,
}: {
  topico: ItemPlanoContas;
  filhos: ItemPlanoContas[];
  onAdicionarFilho: (item: ItemPlanoContas) => void;
  onExcluir: (item: ItemPlanoContas) => void;
  mostrarMaisNasLinhas?: boolean;
}) {
  return (
    <div className="mb-7 last:mb-0">
      <p
        className="mb-2 text-[13px] font-semibold uppercase leading-snug tracking-wide"
        style={{ color: AZUL_TITULO }}
      >
        {topico.codigo} {topico.nome}
      </p>
      {filhos.length > 0 ? (
        <div className="overflow-hidden rounded-sm border border-slate-600/80 bg-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          {filhos.map((filho, index) => (
            <LinhaSubconta
              key={filho.id}
              item={filho}
              topico={topico}
              indice={index}
              comBordaInferior={index < filhos.length - 1}
              onAdicionarFilho={onAdicionarFilho}
              onExcluir={onExcluir}
              mostrarMais={mostrarMaisNasLinhas}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PainelSecao({
  titulo,
  itens,
  onAdicionarFilho,
  onExcluir,
  mostrarMaisNasLinhas = true,
}: {
  titulo: string;
  itens: ItemPlanoContas[];
  onAdicionarFilho: (item: ItemPlanoContas) => void;
  onExcluir: (item: ItemPlanoContas) => void;
  mostrarMaisNasLinhas?: boolean;
}) {
  const grupos = agruparPlanoContas(itens);

  return (
    <section className="overflow-hidden rounded-md border border-slate-600/80 bg-slate-900 shadow-[0_4px_18px_rgba(0,0,0,0.35)]">
      <header className="border-b border-slate-600/80 bg-slate-800 px-4 py-3">
        <h2 className="text-[15px] font-bold uppercase tracking-wide text-slate-100">
          {titulo}
        </h2>
      </header>
      <div className="bg-slate-900 px-4 pb-5 pt-4">
        {grupos.map((grupo) => (
          <GrupoPlano
            key={grupo.topico.id}
            topico={grupo.topico}
            filhos={grupo.filhos}
            onAdicionarFilho={onAdicionarFilho}
            onExcluir={onExcluir}
            mostrarMaisNasLinhas={mostrarMaisNasLinhas}
          />
        ))}
      </div>
    </section>
  );
}

type ModalPlanoState = {
  secao: SecaoPlanoContas;
  categoria: ItemPlanoContas;
} | null;

export function PlanoContasConteudo() {
  const [itens, setItens] = useState<ItemPlanoContas[]>(PLANO_CONTAS_PADRAO);
  const [modal, setModal] = useState<ModalPlanoState>(null);
  const [contaParaExcluir, setContaParaExcluir] =
    useState<ItemPlanoContas | null>(null);
  const persistenciaPronta = useRef(false);

  useEffect(() => {
    let cancelado = false;

    async function hidratar() {
      const local = carregarPlanoContas();
      if (!cancelado && local.length > 0) setItens(local);

      const painel = await fetchPainelFinanceiro<PainelFinanceiroPlanoContas>(
        "plano-de-contas"
      );
      if (cancelado || !painel.ok || !Array.isArray(painel.dados.itens)) return;

      setItens(painel.dados.itens);
      salvarPlanoContas(painel.dados.itens);
    }

    void hidratar().finally(() => {
      if (!cancelado) persistenciaPronta.current = true;
    });

    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (!persistenciaPronta.current) return;
    salvarPlanoContas(itens);
  }, [itens]);

  const receitas = filtrarPorSecao(itens, "receitas");
  const despesas = filtrarPorSecao(itens, "despesas");

  function abrirModal(secao: SecaoPlanoContas) {
    return (categoria: ItemPlanoContas) => {
      if (categoria.secao !== secao) return;
      setModal({ secao, categoria });
    };
  }

  function cadastrarConta(pai: ItemPlanoContas, nome: string) {
    setItens((atual) => inserirContaPlano(atual, pai, nome));
  }

  function solicitarExclusao(item: ItemPlanoContas) {
    if (!contaCriadaPeloUsuario(item)) return;
    setContaParaExcluir(item);
  }

  function confirmarExclusao() {
    if (!contaParaExcluir) return;
    setItens((atual) => removerContaPlano(atual, contaParaExcluir));
    setContaParaExcluir(null);
  }

  return (
    <div className="space-y-3 text-xs text-slate-300">
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
        <span>Financeiro</span>
        <span className="text-slate-500">&gt;</span>
        <span className="font-medium text-slate-300">Plano de Contas</span>
      </div>

      <h1 className="text-2xl font-normal text-slate-100">Plano de Contas</h1>

      <div className="space-y-5 rounded-lg bg-slate-950 p-4 ring-1 ring-slate-800">
        <PainelSecao
          titulo="RECEITAS"
          itens={receitas}
          onAdicionarFilho={abrirModal("receitas")}
          onExcluir={solicitarExclusao}
          mostrarMaisNasLinhas
        />
        <PainelSecao
          titulo="DESPESAS"
          itens={despesas}
          onAdicionarFilho={abrirModal("despesas")}
          onExcluir={solicitarExclusao}
        />
      </div>

      <ConfirmacaoExclusaoModal
        open={contaParaExcluir !== null}
        titulo="Excluir conta"
        mensagem="Deseja realmente excluir esta conta do plano de contas?"
        detalhe={
          contaParaExcluir
            ? `${contaParaExcluir.codigo} ${contaParaExcluir.nome}`
            : undefined
        }
        onClose={() => setContaParaExcluir(null)}
        onConfirm={confirmarExclusao}
      />

      <PlanoContasCadastroModal
        open={modal !== null}
        secao={modal?.secao ?? "despesas"}
        itens={itens}
        categoriaInicial={modal?.categoria ?? null}
        onClose={() => setModal(null)}
        onCadastrar={cadastrarConta}
      />
    </div>
  );
}
