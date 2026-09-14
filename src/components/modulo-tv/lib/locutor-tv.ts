"use client";

import { classificarPrazoTv } from "@/components/modulo-tv/lib/prazo-categoria";
import { playTvSound } from "@/components/modulo-tv/lib/tv-sounds";
import type { OrdemServicoTv } from "@/components/modulo-tv/types";
import type { Locale } from "@/lib/i18n";

export const INTERVALO_LOCUTOR_TV_MS = 10 * 60 * 1000;
const LIMITE_PACIENTES_FALA = 8;

export type PacienteAtrasadoFala = {
  id: string;
  numeroOs: number;
  paciente: string;
  horario: string;
  horarioFala: string;
};

export type ResumoLocutorTv = {
  total: number;
  noPrazo: number;
  atrasados: PacienteAtrasadoFala[];
  texto: string;
  chave: string;
};

export function formatarHorarioLocutor(prazoIso: string, locale: Locale = "pt") {
  const data = new Date(prazoIso);
  if (Number.isNaN(data.getTime())) return "";

  const hora = data.getHours();
  const minuto = data.getMinutes();
  const loc =
    locale === "en" ? "en-US" : locale === "es" ? "es-ES" : "pt-BR";

  if (hora === 0 && minuto === 0) {
    const dia = data.toLocaleDateString(loc, { day: "numeric", month: "long" });
    if (locale === "en") return `due ${dia}`;
    if (locale === "es") return `plazo ${dia}`;
    return `prazo ${dia}`;
  }

  const horaTxt = data.toLocaleTimeString(loc, {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (locale === "en") return `at ${horaTxt}`;
  if (locale === "es") return `horario ${horaTxt}`;
  return `horário ${horaTxt}`;
}

function nomePaciente(ordem: OrdemServicoTv) {
  const nome = (ordem.paciente || "").trim();
  return nome || `OS ${ordem.numeroOs}`;
}

export function resumoEntregasLocutorTv(
  ordens: OrdemServicoTv[],
  locale: Locale = "pt"
): ResumoLocutorTv {
  const relevantes = ordens.filter((ordem) => {
    const cat = classificarPrazoTv(ordem);
    return cat === "hoje" || cat === "atrasada";
  });

  const atrasados: PacienteAtrasadoFala[] = relevantes
    .filter((ordem) => ordem.atrasada || classificarPrazoTv(ordem) === "atrasada")
    .sort((a, b) => new Date(a.prazoIso).getTime() - new Date(b.prazoIso).getTime())
    .map((ordem) => ({
      id: ordem.id,
      numeroOs: ordem.numeroOs,
      paciente: nomePaciente(ordem),
      horario: new Date(ordem.prazoIso).toLocaleTimeString(
        locale === "en" ? "en-US" : locale === "es" ? "es-ES" : "pt-BR",
        { hour: "2-digit", minute: "2-digit" }
      ),
      horarioFala: formatarHorarioLocutor(ordem.prazoIso, locale),
    }));

  const idsAtrasados = new Set(atrasados.map((item) => item.id));
  const noPrazo = relevantes.filter((ordem) => !idsAtrasados.has(ordem.id)).length;
  const total = noPrazo + atrasados.length;
  const texto = montarTextoLocutorTv({ total, noPrazo, atrasados, locale });
  const chave = `${total}|${noPrazo}|${atrasados.map((item) => item.id).join(",")}`;

  return { total, noPrazo, atrasados, texto, chave };
}

function q(n: number, um: string, varios: string) {
  return n === 1 ? um : varios;
}

function montarTextoLocutorTv(params: {
  total: number;
  noPrazo: number;
  atrasados: PacienteAtrasadoFala[];
  locale: Locale;
}) {
  const { total, noPrazo, atrasados, locale } = params;
  const nAtrasados = atrasados.length;

  if (locale === "en") {
    if (total === 0) return "Today there are no jobs to deliver.";
    let texto = `Today we have ${total} ${q(total, "job", "jobs")} to deliver. `;
    texto += `We have ${noPrazo} on time and ${nAtrasados} overdue.`;
    texto += listarAtrasadosFala(atrasados, "en");
    return texto;
  }

  if (locale === "es") {
    if (total === 0) return "Hoy no hay trabajos para entregar.";
    let texto = `Hoy tenemos ${total} ${q(total, "trabajo", "trabajos")} para entregar. `;
    texto += `Tenemos ${noPrazo} en plazo y ${nAtrasados} atrasados.`;
    texto += listarAtrasadosFala(atrasados, "es");
    return texto;
  }

  if (total === 0) return "Hoje não há trabalhos para entregar.";
  let texto = `Hoje temos ${total} ${q(total, "trabalho", "trabalhos")} para entregar. `;
  texto += `Temos ${noPrazo} ${q(noPrazo, "no prazo", "no prazo")} e ${nAtrasados} ${q(
    nAtrasados,
    "atrasado",
    "atrasados"
  )}.`;
  texto += listarAtrasadosFala(atrasados, "pt");
  return texto;
}

function listarAtrasadosFala(atrasados: PacienteAtrasadoFala[], locale: Locale) {
  if (atrasados.length === 0) return "";
  const lista = atrasados.slice(0, LIMITE_PACIENTES_FALA);
  const resto = atrasados.length - lista.length;
  const partes = lista.map((item) => {
    if (locale === "en") {
      return ` Overdue patient ${item.paciente}, ${item.horarioFala}, work order ${item.numeroOs}.`;
    }
    if (locale === "es") {
      return ` Paciente atrasado ${item.paciente}, ${item.horarioFala}, OS ${item.numeroOs}.`;
    }
    return ` Paciente atrasado ${item.paciente}, ${item.horarioFala}, ordem ${item.numeroOs}.`;
  });
  let texto = partes.join("");
  if (resto > 0) {
    if (locale === "en") texto += ` And ${resto} more overdue.`;
    else if (locale === "es") texto += ` Y ${resto} atrasados más.`;
    else texto += ` E mais ${resto} atrasados.`;
  }
  return texto;
}

function langLocutor(locale: Locale) {
  if (locale === "en") return "en-US";
  if (locale === "es") return "es-ES";
  return "pt-BR";
}

function escolherVoz(locale: Locale) {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const vozes = window.speechSynthesis.getVoices();
  const lang = langLocutor(locale).toLowerCase();
  const prefixo = lang.slice(0, 2);
  return (
    vozes.find((v) => v.lang.toLowerCase() === lang) ||
    vozes.find((v) => v.lang.toLowerCase().startsWith(prefixo)) ||
    vozes.find((v) => /brazil|portugu|spanish|español|english/i.test(v.name)) ||
    null
  );
}

export function ttsDisponivelLocutorTv() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function pararFalaLocutorTv() {
  if (typeof window === "undefined") return;
  window.speechSynthesis?.cancel();
}

export function carregarVozesLocutorTv() {
  if (!ttsDisponivelLocutorTv()) return;
  window.speechSynthesis.getVoices();
}

export function falarTextoLocutorTv(texto: string, locale: Locale = "pt"): Promise<void> {
  return new Promise((resolve) => {
    if (!ttsDisponivelLocutorTv() || !texto.trim()) {
      resolve();
      return;
    }

    const synth = window.speechSynthesis;
    synth.cancel();
    playTvSound("alerta");

    const iniciar = () => {
      const utt = new SpeechSynthesisUtterance(texto);
      utt.lang = langLocutor(locale);
      utt.rate = 0.94;
      utt.pitch = 1;
      utt.volume = 1;
      const voz = escolherVoz(locale);
      if (voz) utt.voice = voz;
      utt.onend = () => resolve();
      utt.onerror = () => resolve();
      window.setTimeout(() => synth.speak(utt), 280);
    };

    const vozes = synth.getVoices();
    if (vozes.length === 0) {
      const onVoices = () => {
        synth.removeEventListener("voiceschanged", onVoices);
        iniciar();
      };
      synth.addEventListener("voiceschanged", onVoices);
      window.setTimeout(() => {
        synth.removeEventListener("voiceschanged", onVoices);
        iniciar();
      }, 400);
      return;
    }

    iniciar();
  });
}
