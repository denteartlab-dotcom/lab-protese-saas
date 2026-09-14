"use client";

import { classificarPrazoTv } from "@/components/modulo-tv/lib/prazo-categoria";
import { playTvSound, type TvSoundType } from "@/components/modulo-tv/lib/tv-sounds";
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
  prazoIso: string;
};

export type ResumoLocutorTv = {
  total: number;
  noPrazo: number;
  atrasados: PacienteAtrasadoFala[];
  chave: string;
};

function embaralhar<T>(itens: T[]): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function escolher<T>(itens: T[]): T {
  return itens[Math.floor(Math.random() * itens.length)]!;
}

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

  if (locale === "en") {
    if (minuto === 0) return `at ${hora}`;
    if (minuto === 30) return `at ${hora}:30`;
    return `at ${hora}:${String(minuto).padStart(2, "0")}`;
  }
  if (locale === "es") {
    if (minuto === 0) return `a las ${hora}`;
    if (minuto === 30) return `a las ${hora} y media`;
    return `a las ${hora} y ${minuto}`;
  }
  if (minuto === 0) return `às ${hora} horas`;
  if (minuto === 30) return `às ${hora} e meia`;
  return `às ${hora} e ${minuto}`;
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
      prazoIso: ordem.prazoIso,
    }));

  const idsAtrasados = new Set(atrasados.map((item) => item.id));
  const noPrazo = relevantes.filter((ordem) => !idsAtrasados.has(ordem.id)).length;
  const total = noPrazo + atrasados.length;
  const chave = `${total}|${noPrazo}|${atrasados.map((item) => item.id).join(",")}`;

  return { total, noPrazo, atrasados, chave };
}

function q(n: number, um: string, varios: string) {
  return n === 1 ? um : varios;
}

export function montarFalaLocutorTv(
  resumo: ResumoLocutorTv,
  locale: Locale = "pt"
): string {
  const { total, noPrazo, atrasados } = resumo;
  const nAtrasados = atrasados.length;

  if (locale === "en") {
    if (total === 0) {
      return escolher([
        "Nothing to deliver today.",
        "No jobs due today.",
        "The delivery list is empty for today.",
      ]);
    }
    const blocos = [
      escolher([
        `Heads up: ${total} ${q(total, "job", "jobs")} to deliver today.`,
        `Today we have ${total} ${q(total, "delivery", "deliveries")}.`,
        `${total} ${q(total, "job is", "jobs are")} on today's list.`,
      ]),
      escolher([
        `${noPrazo} on time, ${nAtrasados} overdue.`,
        `${noPrazo} still on time. ${nAtrasados} already late.`,
      ]),
      listarAtrasadosFala(atrasados, "en"),
    ].filter(Boolean);
    return embaralhar(blocos).join(" ");
  }

  if (locale === "es") {
    if (total === 0) {
      return escolher([
        "Hoy no hay trabajos para entregar.",
        "La lista de entregas de hoy está vacía.",
        "Por hoy, no hay nada para salir.",
      ]);
    }
    const blocos = [
      escolher([
        `Atención: hoy hay ${total} ${q(total, "trabajo", "trabajos")} para entregar.`,
        `Hoy salen ${total} ${q(total, "entrega", "entregas")}.`,
        `En la lista de hoy hay ${total} ${q(total, "trabajo", "trabajos")}.`,
      ]),
      escolher([
        `${noPrazo} en plazo y ${nAtrasados} atrasados.`,
        `En plazo: ${noPrazo}. Atrasados: ${nAtrasados}.`,
      ]),
      listarAtrasadosFala(atrasados, "es"),
    ].filter(Boolean);
    return embaralhar(blocos).join(" ");
  }

  if (total === 0) {
    return escolher([
      "Por hoje, não tem nenhum trabalho para entregar.",
      "Hoje a lista de entregas está vazia.",
      "Nada para sair hoje.",
    ]);
  }

  const blocoTotal = escolher([
    `Pessoal, hoje são ${total} ${q(total, "trabalho", "trabalhos")} para entregar.`,
    `Atenção, laboratório: ${total} ${q(total, "entrega", "entregas")} na lista de hoje.`,
    `Passando o recado: temos ${total} ${q(total, "trabalho", "trabalhos")} para sair hoje.`,
    `Hoje a produção tem ${total} ${q(total, "trabalho", "trabalhos")} na entrega.`,
    `Gente, ${total} ${q(total, "peça", "peças")} para entregar ainda hoje.`,
  ]);

  const blocoPrazo = escolher([
    nAtrasados === 0
      ? `Todos os ${total} estão no prazo.`
      : noPrazo === 0
        ? `Os ${nAtrasados} já passaram da hora.`
        : `Desses, ${noPrazo} ${q(noPrazo, "ainda está", "ainda estão")} no prazo e ${nAtrasados} ${q(
            nAtrasados,
            "atrasado",
            "atrasados"
          )}.`,
    nAtrasados === 0
      ? "Nenhum atraso por agora."
      : `No prazo: ${noPrazo}. Atrasados: ${nAtrasados}.`,
    nAtrasados === 0
      ? "Tudo dentro do horário combinado."
      : `${noPrazo} no prazo. ${nAtrasados} ${q(nAtrasados, "já atrasou", "já atrasaram")}.`,
  ]);

  const blocoAtrasados = listarAtrasadosFala(atrasados, "pt");
  let blocos = [blocoTotal, blocoPrazo, blocoAtrasados].filter((bloco) => bloco.trim());
  if (blocos.length > 2 && Math.random() < 0.4) {
    blocos.splice(Math.random() < 0.5 ? 0 : 1, 1);
  }
  return embaralhar(blocos).join(" ");
}

function listarAtrasadosFala(atrasados: PacienteAtrasadoFala[], locale: Locale) {
  if (atrasados.length === 0) return "";
  const lista = embaralhar(atrasados).slice(0, LIMITE_PACIENTES_FALA);
  const resto = atrasados.length - lista.length;

  const partes = lista.map((item) => {
    const quando = formatarHorarioLocutor(item.prazoIso, locale);
    if (locale === "en") {
      return escolher([
        `${item.paciente} is overdue, ${quando}, work order ${item.numeroOs}.`,
        `Overdue: ${item.paciente}, ${quando}.`,
        `Please check ${item.paciente}, due ${quando}.`,
      ]);
    }
    if (locale === "es") {
      return escolher([
        `${item.paciente} está atrasado, ${quando}, OS ${item.numeroOs}.`,
        `Atrasado: ${item.paciente}, ${quando}.`,
        `Revisen a ${item.paciente}, era ${quando}.`,
      ]);
    }
    return escolher([
      `${item.paciente} ficou atrasada, combinado ${quando}.`,
      `${item.paciente} já passou da hora, era ${quando}.`,
      `Dá uma olhada em ${item.paciente}, ordem ${item.numeroOs}, ${quando}.`,
      `${item.paciente} ainda não saiu, era para ${quando}.`,
    ]);
  });

  const intro =
    locale === "en"
      ? escolher(["Late jobs:", "These are overdue:", "Please check:"])
      : locale === "es"
        ? escolher(["Los atrasados:", "Ojo con estos atrasos:", "Revisen:"])
        : escolher([
            "Os atrasados agora:",
            "Olha só quem já passou da hora:",
            "Vamos aos atrasados:",
          ]);

  let texto = `${intro} ${partes.join(" ")}`;
  if (resto > 0) {
    if (locale === "en") texto += ` And ${resto} more overdue.`;
    else if (locale === "es") texto += ` Y ${resto} atrasados más.`;
    else texto += ` E mais ${resto} ${q(resto, "atrasado", "atrasados")}.`;
  }
  return texto;
}

function langLocutor(locale: Locale) {
  if (locale === "en") return "en-US";
  if (locale === "es") return "es-ES";
  return "pt-BR";
}

function vozPareceMasculina(nome: string) {
  return /male|masculin|\bman\b|daniel|antonio|antônio|felipe|ricardo|rafael|bruno|google uk english male|microsoft david|microsoft george/i.test(
    nome
  );
}

function vozPareceFeminina(nome: string) {
  return /female|feminina|woman|girl|maria|francisca|luciana|heloisa|heloísa|helena|elvira|paulina|sabina|thalita|camila|vitória|vitoria|zira|samantha|karen|moira|tessa|fiona|veena|lekha|microsoft maria|microsoft francisca|google português|google portugues|português do brasil|portugues do brasil/i.test(
    nome
  );
}

function pontuarVozFeminina(voz: SpeechSynthesisVoice, locale: Locale) {
  const nome = voz.name.toLowerCase();
  const lang = voz.lang.toLowerCase();
  const alvo = langLocutor(locale).toLowerCase();
  let pontos = 0;
  if (lang === alvo) pontos += 8;
  else if (lang.startsWith(alvo.slice(0, 2))) pontos += 5;
  if (vozPareceFeminina(nome)) pontos += 12;
  if (vozPareceMasculina(nome) && !vozPareceFeminina(nome)) pontos -= 20;
  if (/natural|online|neural|wavenet|studio/.test(nome)) pontos += 4;
  if (voz.localService) pontos += 1;
  return pontos;
}

function escolherVoz(locale: Locale) {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const vozes = window.speechSynthesis.getVoices();
  if (!vozes.length) return null;
  const femininas = vozes.filter(
    (voz) => vozPareceFeminina(voz.name) || !vozPareceMasculina(voz.name)
  );
  const pool = femininas.length > 0 ? femininas : vozes;
  const ordenadas = [...pool].sort(
    (a, b) => pontuarVozFeminina(b, locale) - pontuarVozFeminina(a, locale)
  );
  return ordenadas[0] ?? null;
}

const INICIO_AVISO_TRABALHO_MINUTOS = 8 * 60 + 30;
const FIM_AVISO_MINUTOS = 18 * 60;
const INICIO_RELOGIO_HORA = 8;
const FIM_RELOGIO_HORA = 18;

export function locutorDentroDoHorarioAviso(agora = new Date()) {
  const minutos = agora.getHours() * 60 + agora.getMinutes();
  return minutos >= INICIO_AVISO_TRABALHO_MINUTOS && minutos <= FIM_AVISO_MINUTOS;
}

export function locutorDeveAnunciarHora(agora = new Date()) {
  const hora = agora.getHours();
  return hora >= INICIO_RELOGIO_HORA && hora <= FIM_RELOGIO_HORA;
}

export function chaveHoraCheiaLocutor(agora = new Date()) {
  return `${agora.getFullYear()}-${agora.getMonth()}-${agora.getDate()}-${agora.getHours()}`;
}

export function msAteProximaHoraCheia(agora = new Date()) {
  const proxima = new Date(agora.getTime());
  proxima.setSeconds(0, 0);
  proxima.setMinutes(0);
  proxima.setHours(proxima.getHours() + 1);
  return Math.max(proxima.getTime() - agora.getTime(), 250);
}

export function montarFalaHoraAtual(agora = new Date(), locale: Locale = "pt") {
  const hora = agora.getHours();

  if (locale === "en") {
    if (hora === 12) return escolher(["It's noon.", "12 o'clock."]);
    return escolher([`It's ${hora} o'clock.`, `The time is ${hora}.`]);
  }

  if (locale === "es") {
    if (hora === 1) return escolher(["Es la 1.", "La 1 en punto."]);
    if (hora === 12) return escolher(["Es mediodía.", "Las 12 en punto."]);
    return escolher([`Son las ${hora}.`, `Marca las ${hora} horas.`]);
  }

  if (hora === 12) {
    return escolher(["São meio-dia.", "Meio-dia em ponto.", "Pessoal, meio-dia."]);
  }
  if (hora === 18) {
    return escolher(["São 18 horas.", "18 horas em ponto.", "Pessoal, 18 horas."]);
  }

  const periodo = hora < 12 ? "da manhã" : "da tarde";
  return escolher([
    `São ${hora} horas.`,
    `Agora são ${hora} ${periodo}.`,
    `Pessoal, ${hora} horas.`,
    `${hora} horas em ponto.`,
  ]);
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

export function desbloquearAudioLocutorTv() {
  if (typeof window === "undefined") return;
  playTvSound("movida");
  if (!ttsDisponivelLocutorTv()) return;
  const utt = new SpeechSynthesisUtterance(".");
  utt.volume = 0;
  utt.rate = 2;
  window.speechSynthesis.speak(utt);
}

export function falarTextoLocutorTv(
  texto: string,
  locale: Locale = "pt",
  som: TvSoundType | false = "alerta"
): Promise<void> {
  return new Promise((resolve) => {
    if (!ttsDisponivelLocutorTv() || !texto.trim()) {
      resolve();
      return;
    }

    const synth = window.speechSynthesis;
    synth.cancel();
    if (som) playTvSound(som);

    const iniciar = () => {
      const utt = new SpeechSynthesisUtterance(texto);
      utt.lang = langLocutor(locale);
      utt.rate = 1.42;
      utt.pitch = 1.08;
      utt.volume = 1;
      const voz = escolherVoz(locale);
      if (voz) utt.voice = voz;
      utt.onend = () => resolve();
      utt.onerror = () => resolve();
      window.setTimeout(() => synth.speak(utt), 180);
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
