import { apenasDigitos, formatCnpjInput, formatCpfInput } from "@/lib/documento-br";
import { valorLiquidoDeLinhaItemAdicionado } from "@/lib/trabalho-os-segmento";

export type PacienteRecibo = {
  nome: string;
  servico: string;
  quantidade: number;
  valor: number;
};

export type TrabalhoReciboFatura = {
  valor?: number | null;
  tipoProtese?: string | null;
  instrucoes?: string | null;
  paciente?: { nome?: string | null } | null;
};

function parseQtd(texto?: string | null) {
  const n = Number(String(texto || "1").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function itensTrabalhoRecibo(trabalho: TrabalhoReciboFatura) {
  const servicoPadrao = trabalho.tipoProtese?.trim() || "—";
  const itens: Array<{ servico: string; quantidade: number; valor: number }> = [];
  for (const line of (trabalho.instrucoes || "").split("\n")) {
    const match = line.match(
      /^Item adicionado:\s*(.*?)\s*-\s*dentes\s*(.*?)\s*-\s*cor\s*(.*?)\s*-\s*qtd\s*(.*?)\s*-\s*valor\s*(.*)$/i
    );
    if (!match) continue;
    itens.push({
      servico: match[1]?.trim() || servicoPadrao,
      quantidade: parseQtd(match[4]),
      valor: valorLiquidoDeLinhaItemAdicionado(line) ?? 0,
    });
  }
  if (itens.length > 0) return itens;
  return [
    {
      servico: servicoPadrao,
      quantidade: 1,
      valor: Number(trabalho.valor) || 0,
    },
  ];
}

function chavePacienteServico(nome: string, servico: string) {
  return `${nome}\0${servico}`;
}

/** Pacientes da nota com serviço, quantidade e valor. */
export function agregarPacientesRecibo(
  trabalhos: TrabalhoReciboFatura[]
): PacienteRecibo[] {
  const mapa = new Map<string, PacienteRecibo>();
  for (const trabalho of trabalhos) {
    const nome = trabalho.paciente?.nome?.trim() || "—";
    for (const item of itensTrabalhoRecibo(trabalho)) {
      const chave = chavePacienteServico(nome, item.servico);
      const atual = mapa.get(chave);
      if (atual) {
        atual.quantidade += item.quantidade;
        atual.valor += item.valor;
      } else {
        mapa.set(chave, {
          nome,
          servico: item.servico,
          quantidade: item.quantidade,
          valor: item.valor,
        });
      }
    }
  }
  return [...mapa.values()].sort(
    (a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR") ||
      a.servico.localeCompare(b.servico, "pt-BR")
  );
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

export function formatarDocumentoClienteRecibo(cnpjCpf?: string | null) {
  const bruto = (cnpjCpf || "").trim();
  if (!bruto) return "";
  const digits = apenasDigitos(bruto);
  if (digits.length === 11) return `CPF: ${formatCpfInput(digits)}`;
  if (digits.length === 14) return `CNPJ: ${formatCnpjInput(digits)}`;
  return bruto;
}

export function formatarQtdRecibo(quantidade: number) {
  if (Number.isInteger(quantidade)) return String(quantidade);
  return quantidade.toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
  });
}
