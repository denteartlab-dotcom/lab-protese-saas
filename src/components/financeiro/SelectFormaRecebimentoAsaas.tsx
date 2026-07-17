"use client";

import {
  OPCOES_FORMA_RECEBIMENTO_OS,
  OPCOES_FORMA_RECEBIMENTO_SIMPLES,
  formaExigeAsaasCobranca,
  type OpcaoFormaRecebimento,
} from "@/lib/formas-recebimento-asaas";

type Props = {
  value: string;
  onChange: (value: string) => void;
  asaasDisponivel: boolean;
  className?: string;
  /** Lista completa (OS) ou compacta. */
  variante?: "os" | "simples";
};

function rotuloOpcao(op: OpcaoFormaRecebimento, asaasDisponivel: boolean) {
  if (op.exigeAsaas && !asaasDisponivel) {
    return `${op.label} (conta digital)`;
  }
  return op.label;
}

export function SelectFormaRecebimentoAsaas({
  value,
  onChange,
  asaasDisponivel,
  className,
  variante = "os",
}: Props) {
  const opcoes =
    variante === "simples" ? OPCOES_FORMA_RECEBIMENTO_SIMPLES : OPCOES_FORMA_RECEBIMENTO_OS;

  return (
    <select
      value={value || (variante === "os" ? "Forma Pagamento" : "")}
      onChange={(e) => {
        const next = e.target.value;
        if (formaExigeAsaasCobranca(next) && !asaasDisponivel) return;
        onChange(next);
      }}
      className={className}
      title={
        asaasDisponivel
          ? undefined
          : "Pix e Boleto ficam disponíveis após criar a conta digital Asaas (subconta)."
      }
    >
      {opcoes.map((op) => {
        const bloqueada = Boolean(op.exigeAsaas && !asaasDisponivel);
        return (
          <option
            key={op.value || op.label}
            value={op.value}
            disabled={bloqueada}
            style={bloqueada ? { color: "#c0c4cc" } : undefined}
          >
            {rotuloOpcao(op, asaasDisponivel)}
          </option>
        );
      })}
    </select>
  );
}
