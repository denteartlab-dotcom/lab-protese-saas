import {
  caixaAgenda,
  colaboradorAgenda,
  etapaAtualAgenda,
  prazoTextoAgenda,
  qtdAgenda,
  trabalhoAtrasadoAgenda,
  type LinhaAgendaPdf,
  type TrabalhoAgenda,
} from "@/lib/agenda-producao";
import { dateKeyLocal, prazoTrabalho } from "@/lib/controle-producao-prazos";
import {
  classificarItemOs,
  linhasServicoDoGrupoOs,
  segmentoEfetivoTrabalho,
} from "@/lib/trabalho-os-segmento";
import { escolherTrabalhoServicoGrupoOs } from "@/lib/modulo-producao-os";
import { formatCurrency, formatDate } from "@/lib/utils";

export type TrabalhoAgendaGrupo = TrabalhoAgenda & {
  segmentoFaturamento?: string | null;
  grupoOsId?: string | null;
  dentes?: string | null;
  cor?: string | null;
  material?: string | null;
  escala?: string | null;
  valor?: number;
  dataEntrega?: string | null;
  observacoes?: string | null;
};

export type LinhaAgendaGrupoOs = {
  chaveGrupo: string;
  principal: TrabalhoAgendaGrupo;
  servicos: TrabalhoAgendaGrupo[];
  grupoCompleto: TrabalhoAgendaGrupo[];
};

function parseMoney(value: string) {
  const normalized = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return Number(normalized) || 0;
}

function valorComDesconto(valor: number, desconto?: string) {
  if (!desconto) return valor;
  const texto = desconto.trim();
  if (!texto || texto === "0" || texto === "0,00") return valor;
  if (texto.startsWith("R$")) {
    return Math.max(valor - parseMoney(texto), 0);
  }
  const pct = Math.min(Math.max(Number(texto.replace("%", "").replace(",", ".")) || 0, 0), 100);
  return Math.max(valor - valor * (pct / 100), 0);
}

export function parseItensAgenda(trabalho: TrabalhoAgendaGrupo) {
  const lines = (trabalho.instrucoes || "").split("\n");
  const itens = lines
    .map((line, index) => {
      const match = line.match(
        /^Item adicionado:\s*(.*?)\s*-\s*dentes\s*(.*?)\s*-\s*cor\s*(.*?)\s*-\s*qtd\s*(.*?)\s*-\s*valor\s*(.*)$/i
      );
      if (!match) return null;
      const valorBruto = line.match(
        / - valor (.*?)(?: - categoria| - desc| - situação| - produtoId| - urgente| - repetição| - repeticao| - obs|$)/i
      )?.[1];
      return {
        id: `${trabalho.id}-item-${index}`,
        servico: match[1]?.trim() || trabalho.tipoProtese,
        numeroDente: match[2]?.trim() || trabalho.dentes || "-",
        corDente: match[3]?.trim() || trabalho.cor || "-",
        quantidade: match[4]?.trim() || "1",
        valor: parseMoney(valorBruto || match[5] || ""),
        desconto:
          line.match(
            / - desc (.*?)(?: - categoria| - situação| - produtoId| - urgente| - repetição| - repeticao| - obs|$)/i
          )?.[1]?.trim() || "",
      };
    })
    .filter(Boolean) as Array<{
    id: string;
    servico: string;
    numeroDente: string;
    corDente: string;
    quantidade: string;
    valor: number;
    desconto: string;
  }>;

  if (itens.length > 0) return itens;

  return [
    {
      id: `${trabalho.id}-principal`,
      servico: trabalho.tipoProtese,
      numeroDente: trabalho.dentes || "-",
      corDente: trabalho.cor || "-",
      quantidade: "1",
      valor: trabalho.valor || 0,
      desconto: "",
    },
  ];
}

/** Uma linha por número de OS — agrupa serviços, produto e transporte do mesmo protocolo. */
export function agruparTrabalhosAgenda(trabalhos: TrabalhoAgendaGrupo[]): LinhaAgendaGrupoOs[] {
  const somenteServico = trabalhos.filter(
    (t) => segmentoEfetivoTrabalho(t) === "servico"
  );
  const porNumeroOs = new Map<number, TrabalhoAgendaGrupo[]>();

  for (const trabalho of somenteServico) {
    const lista = porNumeroOs.get(trabalho.numeroOs) ?? [];
    lista.push(trabalho);
    porNumeroOs.set(trabalho.numeroOs, lista);
  }

  return Array.from(porNumeroOs.entries())
    .sort(([a], [b]) => b - a)
    .map(([numeroOs, servicos]) => {
      const grupoCompleto = trabalhos.filter((t) => t.numeroOs === numeroOs);
      return {
        chaveGrupo: String(numeroOs),
        servicos,
        principal: escolherTrabalhoServicoGrupoOs(servicos) as TrabalhoAgendaGrupo,
        grupoCompleto,
      };
    });
}

export function servicosTextoAgenda(linha: LinhaAgendaGrupoOs) {
  const nomes = linha.servicos
    .map((t) => t.tipoProtese?.trim())
    .filter(Boolean);
  return nomes.length ? [...new Set(nomes)].join(", ") : linha.principal.tipoProtese;
}

export function qtdTextoAgendaGrupo(linha: LinhaAgendaGrupoOs) {
  const total = linha.servicos.reduce((sum, t) => {
    const qtd = Number(qtdAgenda(t.instrucoes)) || 1;
    return sum + qtd;
  }, 0);
  return String(total || 1);
}

export function colaboradorAgendaGrupo(linha: LinhaAgendaGrupoOs) {
  const textos = linha.grupoCompleto
    .map((t) => colaboradorAgenda(t.instrucoes))
    .filter(Boolean);
  return [...new Set(textos)].join(", ");
}

export function etapaAtualAgendaGrupo(linha: LinhaAgendaGrupoOs) {
  return etapaAtualAgenda(linha.principal.instrucoes);
}

export function caixaAgendaGrupo(linha: LinhaAgendaGrupoOs) {
  for (const t of linha.grupoCompleto) {
    const caixa = caixaAgenda(t.instrucoes);
    if (caixa) return caixa;
  }
  return "";
}

export function prazoTextoAgendaGrupo(linha: LinhaAgendaGrupoOs) {
  return prazoTextoAgenda(linha.principal);
}

export function instrucoesConsolidadasGrupo(linha: LinhaAgendaGrupoOs) {
  return linha.grupoCompleto
    .map((t) => t.instrucoes || "")
    .filter(Boolean)
    .join("\n");
}

export function osExternaAgenda(instrucoes?: string | null) {
  const line = (instrucoes || "")
    .split("\n")
    .find((item) => /^os externa:/i.test(item.trim()));
  return line?.replace(/^os externa:\s*/i, "").trim() || "";
}

export function prazoDentistaTextoAgenda(trabalho: TrabalhoAgendaGrupo) {
  const prazo = prazoTrabalho(trabalho, "dentista");
  if (!prazo) return "";
  return prazo.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function descontoTextoAgendaGrupo(linha: LinhaAgendaGrupoOs) {
  const descontos = linha.servicos.flatMap((t) =>
    parseItensAgenda(t)
      .filter((item) => classificarItemOs(item) === "servico")
      .map((item) => item.desconto)
      .filter((d) => d && d !== "0" && d !== "0,00")
  );
  const primeiro = descontos[0];
  if (!primeiro) return "";
  return primeiro.includes("%") ? primeiro : `% ${primeiro}`;
}

export function valorUnitarioAgendaGrupo(linha: LinhaAgendaGrupoOs) {
  const item = parseItensAgenda(linha.principal).find(
    (i) => classificarItemOs(i) === "servico"
  );
  if (!item) return formatCurrency(linha.principal.valor || 0);
  const qtd = Number(item.quantidade || 1) || 1;
  return (item.valor / qtd).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function totalAgendaGrupo(linha: LinhaAgendaGrupoOs) {
  let total = 0;
  for (const t of linha.servicos) {
    for (const item of parseItensAgenda(t)) {
      if (classificarItemOs(item) !== "servico") continue;
      total += valorComDesconto(item.valor, item.desconto);
    }
  }
  if (total === 0) {
    total = linha.servicos.reduce((sum, t) => sum + (t.valor || 0), 0);
  }
  return formatCurrency(total);
}

export function produtosAgendaGrupo(linha: LinhaAgendaGrupoOs) {
  return linha.grupoCompleto
    .filter((t) => segmentoEfetivoTrabalho(t) === "produto")
    .flatMap((t) =>
      parseItensAgenda(t).map((item) => ({
        id: item.id,
        nome: item.servico.replace(/^Produto:\s*/i, "").trim() || t.tipoProtese,
        quantidade: item.quantidade,
        valor: item.valor,
      }))
    );
}

export type AnexoAgendaOs = { name: string; type: string; url: string };

export function anexosAgendaGrupo(linha: LinhaAgendaGrupoOs): AnexoAgendaOs[] {
  const vistos = new Set<string>();
  const anexos: AnexoAgendaOs[] = [];
  for (const t of linha.grupoCompleto) {
    for (const line of (t.instrucoes || "").split("\n")) {
      if (!line.startsWith("Arquivo anexado:")) continue;
      const [name, type, url] = line
        .replace("Arquivo anexado:", "")
        .split("|")
        .map((item) => item.trim());
      if (!url || vistos.has(url)) continue;
      vistos.add(url);
      anexos.push({ name: name || "Arquivo", type: type || "", url });
    }
  }
  return anexos;
}

export function dataFinalizadoEntregueAgenda(linha: LinhaAgendaGrupoOs) {
  for (const t of linha.grupoCompleto) {
    if (t.dataEntrega) return formatDate(t.dataEntrega);
    if (t.status === "entregue" || t.status === "finalizado") {
      return formatDate(t.dataPrevista) || formatDate(t.dataEntrada);
    }
  }
  return "";
}

export function linhasServicoAgenda(linha: LinhaAgendaGrupoOs) {
  return linhasServicoDoGrupoOs(linha.grupoCompleto);
}

export function mapearLinhaAgendaPdfGrupo(linha: LinhaAgendaGrupoOs): LinhaAgendaPdf {
  const prazoDate = prazoTrabalho(linha.principal, "lab");
  return {
    os: String(linha.principal.numeroOs),
    caixa: caixaAgendaGrupo(linha),
    prazo: prazoTextoAgendaGrupo(linha),
    qtd: qtdTextoAgendaGrupo(linha),
    servico: servicosTextoAgenda(linha),
    cliente: linha.principal.cliente?.nome?.trim() || "",
    paciente: linha.principal.paciente?.nome?.trim() || "",
    colaborador: colaboradorAgendaGrupo(linha),
    etapas: etapaAtualAgendaGrupo(linha),
    prazoOrdenacao: prazoDate ? prazoDate.getTime() : Number.MAX_SAFE_INTEGER,
  };
}

export function filtrarLinhasAgendaGrupo(
  linhas: LinhaAgendaGrupoOs[],
  filtro: string,
  cliente?: string
) {
  let base = linhas;
  if (cliente) {
    base = base.filter(
      (linha) => (linha.principal.cliente?.nome?.trim() || "") === cliente
    );
  }
  if (filtro === "atrasados") {
    return base.filter((linha) => trabalhoAtrasadoAgenda(linha.principal));
  }
  if (filtro.startsWith("data-")) {
    const data = filtro.replace("data-", "");
    return base.filter((linha) => {
      const prazo = prazoTrabalho(linha.principal, "lab");
      return prazo ? dateKeyLocal(prazo) === data : false;
    });
  }
  return base;
}
