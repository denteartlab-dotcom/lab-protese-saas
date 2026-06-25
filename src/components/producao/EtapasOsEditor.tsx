"use client";

import { useEffect, useMemo, useState } from "react";
import { Info, Trash2 } from "lucide-react";
import { CampoDataBr, CampoHoraBr, Select } from "@/components/ui";
import { cn } from "@/lib/utils";
import { propsInputComSelecaoAoFocar } from "@/lib/input-selecao";
import {
  carregarColaboradoresListagem,
  type ColaboradorListagem,
} from "@/lib/colaboradores-listagem";
import {
  carregarEtapasCadastro,
  deduplicarEtapas,
  exibirComissaoPercentual,
  formatarLinhaEtapaComTempo,
  nomeEtapaSemSetor,
  prazoVencimentoEtapaOs,
  type EtapaCadastro,
  type EtapaOsLinha,
} from "@/lib/etapas-os";
import { carregarSetoresCadastro, type SetorCadastro } from "@/lib/setores-cadastro";
import {
  situacaoEtapaServico,
  podeAlterarSituacaoEtapaServico,
  type SituacaoEtapaServico,
} from "@/lib/modulo-producao-etapas";
import {
  carregarConfiguracoesGerais,
  CONFIG_GERAIS_ATUALIZADA_EVENT,
} from "@/lib/configuracoes-gerais";
import {
  comissaoColaboradorNaTabelaServico,
  montarPrazoEtapaOs,
  servicoTemEtapasNaTabela,
  valorMonetarioEtapaServico,
  type ServicoTabelaPrecoOs,
} from "@/lib/tabela-precos-os";

export type EtapaOsFormLinha = {
  nome: string;
  setor: string;
  responsavel: string;
  prazo: string;
  observacao: string;
  comissaoReais?: string;
};

type Props = {
  etapas: EtapaOsFormLinha[];
  onChange: (etapas: EtapaOsFormLinha[]) => void;
  quantidadeDentes?: number;
  dataLancamento?: string;
  horaLaboratorio?: string;
  desabilitado?: boolean;
  servico?: ServicoTabelaPrecoOs;
  repeticao?: boolean;
  /** Índice da etapa em que o serviço está (exibida no Módulo TV). */
  indiceEtapaAtual?: number;
  onIndiceEtapaAtualChange?: (indice: number) => void;
  /** Exibe os blocos editáveis; false = somente o título "Etapas". */
  exibirLinhas?: boolean;
};

function parseMoneyEtapa(value: string) {
  return Number(String(value).replace(/\D/g, "")) / 100 || 0;
}

function partesPrazoEtapaOs(prazo: string) {
  const partes = prazo.trim().split(/\s+/).filter(Boolean);
  const data =
    partes.find((parte) => /^\d{2}\/\d{2}\/\d{4}$/.test(parte)) ||
    (partes[0] && /^\d{2}\/\d{2}\/\d{4}$/.test(partes[0]) ? partes[0] : "");
  const horaBruta = partes.find((parte) => /^\d{1,2}:\d{2}$/.test(parte));
  return { data, hora: horaBruta || "00:00" };
}

function formatComissaoReaisInput(value: string) {
  const centavos = Number(String(value).replace(/\D/g, "")) || 0;
  const amount = centavos / 100;
  return amount.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function etapasFormParaLinhasInstrucoes(
  etapas: EtapaOsFormLinha[],
  opcoes?: {
    prazoGeral?: string;
    quantidadeDentes?: number;
    modelosEtapas?: EtapaCadastro[];
  }
) {
  const modelos = opcoes?.modelosEtapas ?? carregarEtapasCadastro();
  const qtdDentes = Math.max(1, opcoes?.quantidadeDentes ?? 1);
  const prazoGeral = opcoes?.prazoGeral?.trim() || "";

  let lista = deduplicarEtapas(
    etapas.map((etapa, indice) => ({
      indice,
      nome: etapa.nome,
      responsavel: etapa.responsavel,
      prazo: etapa.prazo,
      observacao: etapa.observacao,
    }))
  );

  if (prazoGeral && lista.length > 0) {
    const ultima = lista[lista.length - 1];
    if (!ultima.prazo.trim()) {
      lista = [...lista.slice(0, -1), { ...ultima, prazo: prazoGeral }];
    }
  }

  function tempoCalculado(nome: string) {
    const modelo = modelos.find((etapa) => etapa.nome === nome);
    const tempoMedio = Number(modelo?.tempoMedio || 0);
    if (!tempoMedio) return "";
    const porElemento = modelo?.calculoPorElemento?.toLowerCase() === "sim";
    const tempo = porElemento ? tempoMedio * qtdDentes : tempoMedio;
    return `${tempo} min`;
  }

  return lista
    .map((etapa) =>
      formatarLinhaEtapaComTempo(etapa, tempoCalculado(etapa.nome) || undefined)
    )
    .filter(Boolean)
    .join("\n");
}

export function etapasOsLinhaParaForm(etapas: EtapaOsLinha[]): EtapaOsFormLinha[] {
  return etapas.map((etapa) => ({
    nome: etapa.nome,
    setor: "",
    responsavel: etapa.responsavel,
    prazo: etapa.prazo,
    observacao: etapa.observacao,
    comissaoReais: "0,00",
  }));
}

export function EtapasOsEditor({
  etapas,
  onChange,
  quantidadeDentes = 1,
  dataLancamento = "",
  horaLaboratorio = "",
  desabilitado = false,
  servico,
  repeticao = false,
  indiceEtapaAtual = 0,
  onIndiceEtapaAtualChange,
  exibirLinhas = true,
}: Props) {
  const [modelosEtapas, setModelosEtapas] = useState<EtapaCadastro[]>([]);
  const [setoresCadastrados, setSetoresCadastrados] = useState<SetorCadastro[]>([]);
  const [colaboradoresOpcoes, setColaboradoresOpcoes] = useState<ColaboradorListagem[]>([]);
  const [calendarioEtapaAberto, setCalendarioEtapaAberto] = useState<number | null>(null);
  const [avisoEtapa, setAvisoEtapa] = useState("");
  const [exigeAnteriorFinalizada, setExigeAnteriorFinalizada] = useState(
    () => carregarConfiguracoesGerais().producaoEtapaExigeAnteriorFinalizada
  );

  useEffect(() => {
    const atualizar = () => {
      setExigeAnteriorFinalizada(
        carregarConfiguracoesGerais().producaoEtapaExigeAnteriorFinalizada
      );
    };
    atualizar();
    window.addEventListener(CONFIG_GERAIS_ATUALIZADA_EVENT, atualizar);
    return () => window.removeEventListener(CONFIG_GERAIS_ATUALIZADA_EVENT, atualizar);
  }, []);

  useEffect(() => {
    if (!avisoEtapa) return;
    const timer = window.setTimeout(() => setAvisoEtapa(""), 4000);
    return () => window.clearTimeout(timer);
  }, [avisoEtapa]);

  useEffect(() => {
    setModelosEtapas(carregarEtapasCadastro());
    setSetoresCadastrados(carregarSetoresCadastro());
    setColaboradoresOpcoes(carregarColaboradoresListagem());
  }, []);

  const modeloEtapa = useMemo(
    () => (nome: string) => modelosEtapas.find((etapa) => etapa.nome === nome),
    [modelosEtapas]
  );

  function setorDaEtapa(nome: string) {
    const modelo = modeloEtapa(nome);
    if (!modelo?.setor) return null;
    return setoresCadastrados.find((item) => item.nome === modelo.setor) ?? { nome: modelo.setor };
  }

  function rotuloSetorEtapa(etapa: { nome: string; setor: string }) {
    return etapa.setor.trim() || setorDaEtapa(etapa.nome)?.nome || "Setor não informado";
  }

  function prazoCalculadoEtapa(nome: string) {
    const modelo = modeloEtapa(nome);
    if (!modelo?.prazoDias?.trim()) return "";
    return prazoVencimentoEtapaOs(dataLancamento, modelo.prazoDias);
  }

  function comissaoColaboradorCadastro(cadastro: ColaboradorListagem) {
    const bruto =
      repeticao && cadastro.comissaoRepeticao?.replace(/[^\d]/g, "") !== "000"
        ? cadastro.comissaoRepeticao
        : cadastro.comissaoPercentual || "0,00";
    return exibirComissaoPercentual(bruto) || "0,00%";
  }

  function percentualComissaoEtapaOs(nomeResponsavel: string) {
    if (!nomeResponsavel.trim()) return 0;
    const linhaServico = servico?.comissoesColaboradores?.find(
      (item) => item.nome.trim() === nomeResponsavel.trim()
    );
    if (linhaServico) {
      const bruto = repeticao ? linhaServico.valorRepeticao : linhaServico.valor;
      return parseMoneyEtapa(bruto || "0");
    }
    const cadastro = colaboradoresOpcoes.find((item) => item.nome === nomeResponsavel);
    if (!cadastro) return 0;
    return parseMoneyEtapa(comissaoColaboradorCadastro(cadastro));
  }

  function valoresComissaoPadraoEtapa(etapa: Pick<EtapaOsFormLinha, "nome" | "responsavel">) {
    const pctNumero = percentualComissaoEtapaOs(etapa.responsavel);
    const base = valorMonetarioEtapaServico(servico, etapa.nome);
    const reaisNum = (base * pctNumero) / 100;
    return {
      comissaoReais: formatComissaoReaisInput(String(Math.round(reaisNum * 100))),
    };
  }

  function sincronizarComissaoEtapa(etapa: EtapaOsFormLinha): EtapaOsFormLinha {
    const padrao = valoresComissaoPadraoEtapa(etapa);
    return { ...etapa, comissaoReais: padrao.comissaoReais };
  }

  function atualizarPrazoEtapaOs(index: number, data: string, hora: string) {
    if (desabilitado) return;
    const prazo = montarPrazoEtapaOs(data, hora || "00:00");
    onChange(etapas.map((item, i) => (i === index ? { ...item, prazo } : item)));
  }

  function atualizarComissaoReaisEtapa(index: number, valorDigitado: string) {
    if (desabilitado) return;
    const comissaoReais = formatComissaoReaisInput(valorDigitado);
    onChange(etapas.map((item, i) => (i === index ? { ...item, comissaoReais } : item)));
  }

  function atualizarSituacaoEtapa(index: number, situacao: SituacaoEtapaServico) {
    if (desabilitado || !onIndiceEtapaAtualChange) return;
    const validacao = podeAlterarSituacaoEtapaServico({
      index,
      situacao,
      indiceAtual: indiceEtapaAtual,
      totalEtapas: etapas.length,
      exigeAnteriorFinalizada,
    });
    if (!validacao.permitido) {
      setAvisoEtapa(validacao.motivo || "Não é possível alterar esta etapa agora.");
      return;
    }
    setAvisoEtapa("");
    if (validacao.novoIndice !== undefined) {
      onIndiceEtapaAtualChange(validacao.novoIndice);
      return;
    }
    if (situacao === "atual") {
      onIndiceEtapaAtualChange(index);
    }
  }

  function removerEtapa(index: number) {
    if (desabilitado) return;
    onChange(etapas.filter((_, i) => i !== index));
    if (!onIndiceEtapaAtualChange) return;
    if (index < indiceEtapaAtual) {
      onIndiceEtapaAtualChange(indiceEtapaAtual - 1);
    } else if (index === indiceEtapaAtual) {
      onIndiceEtapaAtualChange(Math.min(indiceEtapaAtual, Math.max(0, etapas.length - 2)));
    }
  }

  useEffect(() => {
    if (!dataLancamento.trim() || modelosEtapas.length === 0 || desabilitado) return;
    let mudou = false;
    const atualizadas = etapas.map((etapa, index) => {
      if (!etapa.nome.trim()) return etapa;
      const isEntrada = index === 0 || /^entrada$/i.test(nomeEtapaSemSetor(etapa.nome));
      if (isEntrada && dataLancamento.trim()) {
        const hora = horaLaboratorio.trim();
        const prazoAuto = hora
          ? `${dataLancamento.trim()} ${hora}`
          : dataLancamento.trim();
        if (etapa.prazo === prazoAuto) return etapa;
        mudou = true;
        return { ...etapa, prazo: prazoAuto };
      }
      const prazoAuto = prazoCalculadoEtapa(etapa.nome);
      if (!prazoAuto || etapa.prazo === prazoAuto) return etapa;
      mudou = true;
      return { ...etapa, prazo: prazoAuto };
    });
    if (mudou) onChange(atualizadas);
  }, [dataLancamento, horaLaboratorio, modelosEtapas, desabilitado, etapas, onChange]);

  useEffect(() => {
    if (desabilitado || etapas.length === 0) return;
    let mudou = false;
    const proximas = etapas.map((etapa) => {
      if (!etapa.responsavel.trim() || !etapa.nome.trim()) return etapa;
      const padrao = valoresComissaoPadraoEtapa(etapa);
      if (etapa.comissaoReais === padrao.comissaoReais) return etapa;
      mudou = true;
      return { ...etapa, comissaoReais: padrao.comissaoReais };
    });
    if (mudou) onChange(proximas);
  }, [repeticao, servico, desabilitado, etapas, onChange]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-800">Etapas</span>
        {exibirLinhas ? (
          <button
            type="button"
            className="rounded bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-700"
            title="Recurso em teste"
          >
            Buscar Melhor data e horário com IA (em teste)
          </button>
        ) : null}
      </div>

      {servicoTemEtapasNaTabela(servico) ? (
        exibirLinhas ? (
        <div className="max-h-[min(420px,52vh)] space-y-3 overflow-y-auto overflow-x-hidden pr-1">
          {avisoEtapa ? (
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
              {avisoEtapa}
            </div>
          ) : null}
          {etapas.map((etapa, index) => {
            const { data: dataEtapa, hora: horaEtapa } = partesPrazoEtapaOs(etapa.prazo);
            const setorRotulo = rotuloSetorEtapa(etapa);
            const situacao = situacaoEtapaServico(index, indiceEtapaAtual);
            return (
              <div
                key={`${etapa.nome}-${index}`}
                className={cn(
                  "rounded border bg-white p-3 shadow-sm",
                  situacao === "atual"
                    ? "border-primary-500 ring-1 ring-primary-200"
                    : "border-slate-200"
                )}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-slate-800">
                      {nomeEtapaSemSetor(etapa.nome) || `Etapa ${index + 1}`}
                    </span>
                    <Info className="h-4 w-4 shrink-0 text-primary-600" aria-hidden />
                  </div>
                  <span className="text-xs font-medium text-primary-600">{setorRotulo}</span>
                </div>

                <div className="grid items-end gap-3 md:grid-cols-[minmax(9.5rem,1.1fr)_minmax(9rem,1fr)_minmax(6rem,0.75fr)_minmax(12rem,1.6fr)_minmax(9rem,1.1fr)_auto]">
                  {onIndiceEtapaAtualChange && (
                    <Select
                      label="Etapa do serviço"
                      value={situacao}
                      disabled={desabilitado}
                      onChange={(e) =>
                        atualizarSituacaoEtapa(index, e.target.value as SituacaoEtapaServico)
                      }
                    >
                      <option value="concluida">Concluída</option>
                      <option value="atual">Etapa atual</option>
                      <option value="aguardando">Aguardando</option>
                    </Select>
                  )}

                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">
                      Prazo
                    </label>
                    <div className="flex items-center gap-2 rounded border border-slate-300 bg-white px-2 py-0.5">
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 accent-primary-600"
                        disabled={desabilitado}
                        aria-label={`Confirmar prazo de ${nomeEtapaSemSetor(etapa.nome)}`}
                      />
                      <CampoDataBr
                        value={dataEtapa}
                        onChange={(data) => atualizarPrazoEtapaOs(index, data, horaEtapa)}
                        placeholder="dd/mm/aaaa"
                        className="min-w-0 flex-1 space-y-0"
                        inputClassName="h-8 border-0 px-1 py-1 pr-8 shadow-none focus:ring-0"
                        iconPosition="right"
                        forceClose={calendarioEtapaAberto !== index}
                        onCalendarOpenChange={(open) =>
                          setCalendarioEtapaAberto(open ? index : null)
                        }
                      />
                    </div>
                  </div>

                  <CampoHoraBr
                    label="Hora"
                    value={horaEtapa}
                    onChange={(hora) => atualizarPrazoEtapaOs(index, dataEtapa, hora)}
                    placeholder="00:00"
                    inputClassName="h-10 py-2"
                    disabled={desabilitado}
                  />

                  <Select
                    label="Colaborador"
                    value={etapa.responsavel}
                    disabled={desabilitado}
                    onChange={(e) =>
                      onChange(
                        etapas.map((item, i) =>
                          i === index
                            ? sincronizarComissaoEtapa({
                                ...item,
                                responsavel: e.target.value,
                              })
                            : item
                        )
                      )
                    }
                  >
                    <option value="">Selecione um colaborador</option>
                    {etapa.responsavel &&
                      !colaboradoresOpcoes.some(
                        (colaborador) => colaborador.nome === etapa.responsavel
                      ) && <option value={etapa.responsavel}>{etapa.responsavel}</option>}
                    {colaboradoresOpcoes.map((colaborador) => (
                      <option key={colaborador.id} value={colaborador.nome}>
                        {colaborador.nome}
                      </option>
                    ))}
                  </Select>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-slate-600">
                      Valor Comissão
                    </label>
                    <div className="flex h-10 overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
                      <span className="flex w-10 shrink-0 items-center justify-center border-r border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        R$
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        disabled={desabilitado}
                        value={etapa.comissaoReais || "0,00"}
                        onChange={(e) => atualizarComissaoReaisEtapa(index, e.target.value)}
                        className="h-full w-full bg-transparent px-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50"
                        {...propsInputComSelecaoAoFocar({})}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={desabilitado}
                    onClick={() => removerEtapa(index)}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                    title="Excluir etapa"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        ) : null
      ) : (
        <p className="text-[11px] text-slate-500">
          {servico
            ? `Nenhuma etapa cadastrada na tabela de preços do serviço ${servico.nome}.`
            : "Selecione um serviço com etapas cadastradas na tabela de preços."}
        </p>
      )}
    </div>
  );
}
