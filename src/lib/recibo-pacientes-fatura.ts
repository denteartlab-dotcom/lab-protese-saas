import { valorLiquidoDeLinhaItemAdicionado } from "@/lib/trabalho-os-segmento";

export type PacienteRecibo = {
  nome: string;
  valor: number;
};

export type TrabalhoReciboFatura = {
  valor?: number | null;
  instrucoes?: string | null;
  paciente?: { nome?: string | null } | null;
};

function valorTrabalhoRecibo(trabalho: TrabalhoReciboFatura) {
  const linhas = (trabalho.instrucoes || "")
    .split("\n")
    .map((line) => valorLiquidoDeLinhaItemAdicionado(line))
    .filter((n): n is number => n != null);
  if (linhas.length > 0) {
    return linhas.reduce((soma, n) => soma + n, 0);
  }
  return Number(trabalho.valor) || 0;
}

/** Agrupa os pacientes da nota com o valor correspondente. */
export function agregarPacientesRecibo(
  trabalhos: TrabalhoReciboFatura[]
): PacienteRecibo[] {
  const mapa = new Map<string, number>();
  for (const trabalho of trabalhos) {
    const nome = trabalho.paciente?.nome?.trim() || "—";
    mapa.set(nome, (mapa.get(nome) || 0) + valorTrabalhoRecibo(trabalho));
  }
  return [...mapa.entries()]
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function formatarEnderecoClienteRecibo(cliente?: {
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
} | null) {
  if (!cliente) return "";
  const rua = (cliente.endereco || "").trim();
  const cidadeUf = [cliente.cidade?.trim(), cliente.uf?.trim()].filter(Boolean).join("/");
  const cep = (cliente.cep || "").trim();
  return [rua, cidadeUf, cep ? `CEP ${cep}` : ""]
    .filter(Boolean)
    .join(" — ");
}
