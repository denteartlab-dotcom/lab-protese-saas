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
import { useI18n } from "@/components/i18n-provider";
import { BreadcrumbFinanceiro } from "@/components/financeiro/BreadcrumbFinanceiro";
import { PlanoContasCadastroModal } from "@/components/financeiro/PlanoContasCadastroModal";
import { nomeExibicaoPlanoContas } from "@/lib/i18n/plano-contas-i18n";

function BotaoMais({
  item,
  onAdicionarFilho,
}: {
  item: ItemPlanoContas;
  onAdicionarFilho: (item: ItemPlanoContas) => void;
}) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      title={t("financeiro.plano.adicionarSubconta")}
      onClick={() => onAdicionarFilho(item)}
      className="shrink-0 border-0 bg-transparent p-0 text-[20px] font-normal leading-none text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
      aria-label={t("financeiro.plano.adicionarSubconta")}
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
  const { t } = useI18n();
  return (
    <button
      type="button"
      title={t("financeiro.plano.excluirConta")}
      onClick={() => onExcluir(item)}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border-0 bg-transparent text-red-500 hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-950/60 dark:hover:text-red-300"
      aria-label={t("financeiro.plano.excluirConta")}
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
  const { t } = useI18n();
  const podeExcluir = contaCriadaPeloUsuario(item);
  const profundidade = profundidadeRelativaAoGrupo(item, topico);
  const recuo =
    profundidade <= 1 ? "pl-4" : profundidade === 2 ? "pl-8" : "pl-12";

  return (
    <div
      className={`flex min-h-[44px] items-center justify-between gap-4 px-4 py-[13px] ${
        indice % 2 === 0
          ? "bg-white dark:bg-slate-800/90"
          : "bg-slate-50 dark:bg-slate-700/80"
      } ${comBordaInferior ? "border-b border-slate-200 dark:border-slate-600/70" : ""}`}
    >
      <span
        className={`text-[13px] leading-snug text-slate-700 dark:text-slate-100 ${recuo}`}
      >
        <span className="font-medium text-sky-700 dark:text-sky-300/90">
          {item.codigo}
        </span>{" "}
        {nomeExibicaoPlanoContas(item, t)}
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
  const { t } = useI18n();
  return (
    <div className="mb-7 last:mb-0">
      <p className="mb-2 text-[13px] font-semibold uppercase leading-snug tracking-wide text-sky-700 dark:text-sky-300">
        {topico.codigo} {nomeExibicaoPlanoContas(topico, t)}
      </p>
      {filhos.length > 0 ? (
        <div className="overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm dark:border-slate-600/80 dark:bg-slate-900 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
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
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-600/80 dark:bg-slate-900 dark:shadow-[0_4px_18px_rgba(0,0,0,0.35)]">
      <header className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-600/80 dark:bg-slate-800">
        <h2 className="text-[15px] font-bold uppercase tracking-wide text-slate-800 dark:text-slate-100">
          {titulo}
        </h2>
      </header>
      <div className="bg-white px-4 pb-5 pt-4 dark:bg-slate-900">
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
  const { t } = useI18n();
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
    <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
      <BreadcrumbFinanceiro pagina="financeiro.breadcrumb.planoContas" />

      <h1 className="text-2xl font-normal text-slate-800 dark:text-slate-100">
        {t("financeiro.plano.titulo")}
      </h1>

      <div className="space-y-5 rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-800">
        <PainelSecao
          titulo={t("financeiro.plano.receitas")}
          itens={receitas}
          onAdicionarFilho={abrirModal("receitas")}
          onExcluir={solicitarExclusao}
          mostrarMaisNasLinhas
        />
        <PainelSecao
          titulo={t("financeiro.plano.despesas")}
          itens={despesas}
          onAdicionarFilho={abrirModal("despesas")}
          onExcluir={solicitarExclusao}
        />
      </div>

      <ConfirmacaoExclusaoModal
        open={contaParaExcluir !== null}
        titulo={t("financeiro.plano.excluirTitulo")}
        mensagem={t("financeiro.plano.excluirMensagem")}
        detalhe={
          contaParaExcluir
            ? `${contaParaExcluir.codigo} ${nomeExibicaoPlanoContas(contaParaExcluir, t)}`
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
