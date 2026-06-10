"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Minus, Plus, Save } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils";
import {
  OPCOES_FONTE_IMPRESSAO,
  schemaConfigImpressaoTabelaPrecos,
  type ConfigImpressaoTabelaPrecos,
} from "@/lib/tabela-precos-impressao-config";

type Props = {
  valoresIniciais: ConfigImpressaoTabelaPrecos;
  onAlteracao: (config: ConfigImpressaoTabelaPrecos) => void;
  onSalvar: (config: ConfigImpressaoTabelaPrecos) => Promise<void>;
  salvando?: boolean;
};

function CampoRotulo({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-[11px] font-medium text-slate-600">
      {children}
    </label>
  );
}

function StepperNumerico({
  valor,
  min,
  max,
  onChange,
}: {
  valor: number;
  min: number;
  max: number;
  onChange: (valor: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, valor - 1))}
        className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
      >
        <Minus className="h-3 w-3" />
      </button>
      <input
        type="number"
        min={min}
        max={max}
        value={valor}
        onChange={(evento) => {
          const numero = Number(evento.target.value);
          if (Number.isFinite(numero)) {
            onChange(Math.min(max, Math.max(min, numero)));
          }
        }}
        className="h-7 w-12 rounded border border-slate-300 text-center text-xs"
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(max, valor + 1))}
        className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}

function SwitchImpressao({
  ligado,
  onChange,
}: {
  ligado: boolean;
  onChange: (valor: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      onClick={() => onChange(!ligado)}
      className={cn(
        "relative h-5 w-9 rounded-full transition-colors",
        ligado ? "bg-emerald-500" : "bg-slate-300"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 block h-4 w-4 rounded-full bg-white shadow transition-transform",
          ligado ? "translate-x-[18px]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

export function PainelConfigImpressaoTabelaPrecos({
  valoresIniciais,
  onAlteracao,
  onSalvar,
  salvando,
}: Props) {
  const { register, watch, setValue, handleSubmit } =
    useForm<ConfigImpressaoTabelaPrecos>({
      resolver: zodResolver(schemaConfigImpressaoTabelaPrecos),
      defaultValues: valoresIniciais,
    });

  const valores = watch();

  useEffect(() => {
    onAlteracao(valores);
  }, [valores, onAlteracao]);

  return (
    <form
      onSubmit={handleSubmit((dados) => void onSalvar(dados))}
      className="flex h-full min-h-0 flex-col"
    >
      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
        <div className="flex items-center justify-between gap-2">
          <CampoRotulo>Mostrar Cabeçalho</CampoRotulo>
          <SwitchImpressao
            ligado={valores.mostrarCabecalho}
            onChange={(valor) =>
              setValue("mostrarCabecalho", valor, { shouldDirty: true })
            }
          />
        </div>

        <div>
          <CampoRotulo>Título</CampoRotulo>
          <input
            {...register("titulo")}
            className="h-8 w-full rounded border border-slate-300 px-2 text-xs"
            placeholder="Título do documento"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <CampoRotulo>Categorias</CampoRotulo>
            <input
              type="color"
              {...register("corCategorias")}
              className="h-8 w-full cursor-pointer rounded border border-slate-300 p-0.5"
            />
          </div>
          <div>
            <CampoRotulo>Serviços</CampoRotulo>
            <input
              type="color"
              {...register("corServicos")}
              className="h-8 w-full cursor-pointer rounded border border-slate-300 p-0.5"
            />
          </div>
          <div>
            <CampoRotulo>Bordas</CampoRotulo>
            <input
              type="color"
              {...register("corBordas")}
              className="h-8 w-full cursor-pointer rounded border border-slate-300 p-0.5"
            />
          </div>
        </div>

        <div>
          <CampoRotulo>Tipo de Fonte</CampoRotulo>
          <select
            {...register("tipoFonte")}
            className="h-8 w-full rounded border border-slate-300 px-2 text-xs"
          >
            {OPCOES_FONTE_IMPRESSAO.map((fonte) => (
              <option key={fonte} value={fonte}>
                {fonte}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between gap-2">
          <CampoRotulo>Tamanho da Fonte</CampoRotulo>
          <StepperNumerico
            valor={valores.tamanhoFonte}
            min={8}
            max={32}
            onChange={(valor) =>
              setValue("tamanhoFonte", valor, { shouldDirty: true })
            }
          />
        </div>

        <div>
          <CampoRotulo>Alinhar Categoria</CampoRotulo>
          <select
            {...register("alinhamentoCategoria")}
            className="h-8 w-full rounded border border-slate-300 px-2 text-xs"
          >
            <option value="esquerda">Esquerda</option>
            <option value="centro">Centralizado</option>
            <option value="direita">Direita</option>
          </select>
        </div>

        <div className="flex items-center justify-between gap-2">
          <CampoRotulo>Espaçamento Categorias (px)</CampoRotulo>
          <StepperNumerico
            valor={valores.espacamentoCategorias}
            min={0}
            max={80}
            onChange={(valor) =>
              setValue("espacamentoCategorias", valor, { shouldDirty: true })
            }
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <CampoRotulo>Espaçamento Serviços</CampoRotulo>
          <StepperNumerico
            valor={valores.espacamentoServicos}
            min={0}
            max={80}
            onChange={(valor) =>
              setValue("espacamentoServicos", valor, { shouldDirty: true })
            }
          />
        </div>

        {(
          [
            ["observacao1", 1],
            ["observacao2", 2],
            ["observacao3", 3],
            ["observacao4", 4],
          ] as const
        ).map(([campo, numero]) => (
          <div key={campo}>
            <CampoRotulo>Observação {numero}</CampoRotulo>
            <input
              {...register(campo)}
              className="h-8 w-full rounded border border-slate-300 px-2 text-xs"
            />
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white p-3">
        <button
          type="submit"
          disabled={salvando}
          className="flex w-full items-center justify-center gap-2 rounded bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-3.5 w-3.5" />
          {salvando ? "Gravando..." : "Gravar Alterações"}
        </button>
      </div>
    </form>
  );
}
