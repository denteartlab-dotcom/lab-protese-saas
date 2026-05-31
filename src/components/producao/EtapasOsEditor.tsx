"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Input, Select } from "@/components/ui";
import {
  carregarColaboradoresListagem,
  type ColaboradorListagem,
} from "@/lib/colaboradores-listagem";
import { formatDateBr } from "@/lib/datas-br";
import {
  carregarEtapasCadastro,
  deduplicarEtapas,
  formatarLinhaEtapaComTempo,
  normalizarNomeEtapaCadastro,
  nomeEtapaSemSetor,
  type EtapaCadastro,
  type EtapaOsLinha,
} from "@/lib/etapas-os";
import { carregarSetoresCadastro, type SetorCadastro } from "@/lib/setores-cadastro";

export type EtapaOsFormLinha = {
  nome: string;
  setor: string;
  responsavel: string;
  prazo: string;
  observacao: string;
};

type Props = {
  etapas: EtapaOsFormLinha[];
  onChange: (etapas: EtapaOsFormLinha[]) => void;
  quantidadeDentes?: number;
  desabilitado?: boolean;
};

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
    nome: normalizarNomeEtapaCadastro(etapa.nome),
    setor: "",
    responsavel: etapa.responsavel,
    prazo: etapa.prazo,
    observacao: etapa.observacao,
  }));
}

export function EtapasOsEditor({
  etapas,
  onChange,
  quantidadeDentes = 1,
  desabilitado = false,
}: Props) {
  const [modelosEtapas, setModelosEtapas] = useState<EtapaCadastro[]>([]);
  const [setoresCadastrados, setSetoresCadastrados] = useState<SetorCadastro[]>([]);
  const [colaboradoresOpcoes, setColaboradoresOpcoes] = useState<ColaboradorListagem[]>([]);

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

  function tempoCalculadoEtapa(nome: string) {
    const modelo = modeloEtapa(nome);
    const tempoMedio = Number(modelo?.tempoMedio || 0);
    if (!tempoMedio) return "";
    const porElemento = modelo?.calculoPorElemento?.toLowerCase() === "sim";
    const tempo = porElemento ? tempoMedio * Math.max(1, quantidadeDentes) : tempoMedio;
    return `${tempo} min`;
  }

  function selecionarEtapa(index: number, nomeEtapa: string) {
    if (desabilitado) return;
    if (nomeEtapa) {
      const duplicata = etapas.findIndex((item, i) => i !== index && item.nome === nomeEtapa);
      if (duplicata >= 0) {
        onChange(etapas.filter((_, i) => i !== index));
        return;
      }
    }
    const modelo = modeloEtapa(nomeEtapa);
    onChange(
      etapas.map((item, i) =>
        i === index
          ? {
              ...item,
              nome: nomeEtapa,
              setor: modelo?.setor || item.setor || "",
            }
          : item
      )
    );
  }

  function adicionarLinhaEtapa() {
    if (desabilitado) return;
    const ultima = etapas[etapas.length - 1];
    if (ultima && !ultima.nome.trim() && !ultima.responsavel.trim() && !ultima.prazo.trim()) return;
    onChange([...etapas, { nome: "", setor: "", responsavel: "", prazo: "", observacao: "" }]);
  }

  return (
    <div className="space-y-3">
      {etapas.length === 0 && (
        <button
          type="button"
          disabled={desabilitado}
          onClick={adicionarLinhaEtapa}
          className="w-full rounded bg-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          + Adicionar Etapa
        </button>
      )}
      <div className="max-h-[min(360px,48vh)] space-y-3 overflow-y-auto overflow-x-hidden pr-1">
        {etapas.map((etapa, index) => (
          <div
            key={`${etapa.nome}-${index}`}
            className="grid gap-2 rounded border border-slate-200 bg-white p-3 md:grid-cols-[1fr_0.75fr_1fr_0.8fr_1fr_1fr_auto]"
          >
            {modelosEtapas.length > 0 ? (
              <Select
                label={index === 0 ? "Entrada" : "Etapa"}
                value={etapa.nome}
                disabled={desabilitado}
                onChange={(e) => selecionarEtapa(index, e.target.value)}
              >
                <option value="">
                  {index === 0 ? "Selecione a etapa de entrada" : "Selecione uma etapa"}
                </option>
                {etapa.nome && !modelosEtapas.some((modelo) => modelo.nome === etapa.nome) && (
                  <option value={etapa.nome}>{nomeEtapaSemSetor(etapa.nome)}</option>
                )}
                {modelosEtapas.map((modelo) => (
                  <option key={modelo.id} value={modelo.nome}>
                    {modelo.nome}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                label={index === 0 ? "Entrada" : "Etapa"}
                value={etapa.nome}
                disabled={desabilitado}
                onChange={(e) => selecionarEtapa(index, e.target.value)}
                placeholder="Nome da etapa"
              />
            )}
            <Select
              label="Setor"
              value={etapa.setor || setorDaEtapa(etapa.nome)?.nome || ""}
              disabled={desabilitado}
              onChange={(e) =>
                onChange(
                  etapas.map((item, i) => (i === index ? { ...item, setor: e.target.value } : item))
                )
              }
            >
              <option value="">Selecione um setor</option>
              {(etapa.setor || setorDaEtapa(etapa.nome)?.nome) &&
                !setoresCadastrados.some(
                  (s) => s.nome === (etapa.setor || setorDaEtapa(etapa.nome)?.nome)
                ) && (
                  <option value={etapa.setor || setorDaEtapa(etapa.nome)?.nome}>
                    {etapa.setor || setorDaEtapa(etapa.nome)?.nome}
                  </option>
                )}
              {setoresCadastrados.map((setor) => (
                <option key={setor.id} value={setor.nome}>
                  {setor.nome}
                </option>
              ))}
            </Select>
            <Select
              label="Responsável"
              value={etapa.responsavel}
              disabled={desabilitado}
              onChange={(e) =>
                onChange(
                  etapas.map((item, i) =>
                    i === index ? { ...item, responsavel: e.target.value } : item
                  )
                )
              }
            >
              <option value="">Selecione um colaborador</option>
              {etapa.responsavel &&
                !colaboradoresOpcoes.some((colaborador) => colaborador.nome === etapa.responsavel) && (
                  <option value={etapa.responsavel}>{etapa.responsavel}</option>
                )}
              {colaboradoresOpcoes.map((colaborador) => (
                <option key={colaborador.id} value={colaborador.nome}>
                  {colaborador.nome}
                </option>
              ))}
            </Select>
            <Input
              label="Tempo"
              value={tempoCalculadoEtapa(etapa.nome)}
              readOnly
              placeholder="0 min"
            />
            <Input
              label="Prazo"
              value={etapa.prazo}
              disabled={desabilitado}
              onChange={(e) =>
                onChange(
                  etapas.map((item, i) =>
                    i === index ? { ...item, prazo: formatDateBr(e.target.value) } : item
                  )
                )
              }
              placeholder="dd/mm/aaaa"
            />
            <Input
              label="Observação"
              value={etapa.observacao}
              disabled={desabilitado}
              onChange={(e) =>
                onChange(
                  etapas.map((item, i) =>
                    i === index ? { ...item, observacao: e.target.value } : item
                  )
                )
              }
              placeholder="Detalhes da etapa"
            />
            <button
              type="button"
              disabled={desabilitado}
              onClick={() => onChange(etapas.filter((_, i) => i !== index))}
              className="mt-6 inline-flex h-10 items-center justify-center rounded border border-red-200 px-3 text-red-600 hover:bg-red-50 disabled:opacity-50"
              title="Excluir etapa"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      {etapas.length > 0 && (
        <button
          type="button"
          disabled={desabilitado}
          onClick={adicionarLinhaEtapa}
          className="w-full rounded bg-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          + Adicionar Etapa
        </button>
      )}
    </div>
  );
}
