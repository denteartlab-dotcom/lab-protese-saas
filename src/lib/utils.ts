import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  formatarDataHoraNoFuso,
  formatarDataNoFuso,
  obterFusoSistema,
} from "@/lib/timezone";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/** Texto de célula/campo vazio — sem traço placeholder. */
export function exibirTexto(value?: string | null) {
  const texto = (value ?? "").trim();
  if (!texto || texto === "—" || texto === "-") return "";
  return texto;
}

/** Nome de colaborador/responsável normalizado (vazio se não cadastrado). */
export function normalizarColaborador(value?: string | null) {
  return exibirTexto(value);
}

export function temColaborador(value?: string | null) {
  return Boolean(normalizarColaborador(value));
}

function parseDateInput(date: Date | string): Date {
  if (date instanceof Date) return date;
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    // Data civil (sem horário): formata pelos componentes, sem fuso.
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
  }
  const matchIsoDia = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (matchIsoDia && !date.includes("T") && !date.includes("Z")) {
    return new Date(
      Number(matchIsoDia[1]),
      Number(matchIsoDia[2]) - 1,
      Number(matchIsoDia[3]),
      12,
      0,
      0,
      0
    );
  }
  return new Date(date);
}

function isValidDate(d: Date) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function formatDateCivilYmd(date: string) {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function formatDate(
  date: Date | string | null | undefined,
  opts?: { fuso?: string }
) {
  if (!date) return "";
  if (typeof date === "string") {
    const civil = formatDateCivilYmd(date);
    if (civil && !date.includes("T") && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(date)) {
      return civil;
    }
  }
  const d = typeof date === "string" ? parseDateInput(date) : date;
  if (!isValidDate(d)) return "";
  return formatarDataNoFuso(d, { fuso: opts?.fuso || obterFusoSistema() });
}

export function formatDateTime(
  date: Date | string | null | undefined,
  opts?: { fuso?: string }
) {
  if (!date) return "";
  const d = typeof date === "string" ? parseDateInput(date) : date;
  if (!isValidDate(d)) return "";
  return formatarDataHoraNoFuso(d, { fuso: opts?.fuso || obterFusoSistema() });
}

export const STATUS_TRABALHO: Record<string, { label: string; color: string }> = {
  finalizado: { label: "Finalizado", color: "bg-blue-100 text-blue-700" },
  producao: { label: "Produção", color: "bg-blue-600 text-white" },
  prova: { label: "Prova", color: "bg-orange-50 text-orange-500" },
  pedido: { label: "Pedido", color: "bg-gray-500 text-white" },
  pendente: { label: "Pendente", color: "bg-red-50 text-red-500" },
  cancelado: { label: "Cancelado", color: "bg-red-500 text-white" },
  saiu_entrega: { label: "Saiu para Entrega", color: "bg-cyan-100 text-cyan-600" },
  entregue_cliente: { label: "Entregue ao cliente", color: "bg-emerald-100 text-emerald-800" },
  recebido_cliente: { label: "Recebido", color: "bg-teal-100 text-teal-700" },
  entregue: { label: "Entregue", color: "bg-emerald-500 text-white" },
};

export const TIPOS_PROTESE = [
  "Coroa metalocerâmica",
  "Coroa em zircônia",
  "Faceta em cerâmica",
  "Prótese total",
  "Prótese parcial removível",
  "Prótese sobre implante",
  "Protocolo",
  "Placa de mordida",
  "Guia cirúrgico",
  "Outro",
];
