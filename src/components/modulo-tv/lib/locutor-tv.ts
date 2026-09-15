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
  const loc = locale === "en" ? "en-US" : locale === "es" ? "es-MX" : "pt-BR";

  if (hora === 0 && minuto === 0) {
    const dia = data.toLocaleDateString(loc, { day: "numeric", month: "long" });
    if (locale === "en") return `due on ${dia}`;
    if (locale === "es") return `con plazo el ${dia}`;
    return `com prazo em ${dia}`;
  }

  if (locale === "en") {
    const opts: Intl.DateTimeFormatOptions = {
      hour: "numeric",
      hour12: true,
    };
    if (minuto !== 0) opts.minute = "2-digit";
    const hora12 = data.toLocaleTimeString("en-US", opts);
    return `at ${hora12}`;
  }

  if (locale === "es") {
    const h12 = ((hora + 11) % 12) + 1;
    if (minuto === 0) {
      if (hora === 12) return "al mediodía";
      if (hora < 12) return hora === 1 ? "a la 1 de la mañana" : `a las ${hora} de la mañana`;
      if (hora < 19) return h12 === 1 ? "a la 1 de la tarde" : `a las ${h12} de la tarde`;
      return h12 === 1 ? "a la 1 de la noche" : `a las ${h12} de la noche`;
    }
    if (minuto === 30) {
      const base = h12 === 1 ? "la 1" : `las ${h12}`;
      return `a ${base} y media`;
    }
    return `a las ${h12} y ${minuto}`;
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
        locale === "en" ? "en-US" : locale === "es" ? "es-MX" : "pt-BR",
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
        "There are no deliveries scheduled for today.",
        "The delivery list is clear for today.",
        "Nothing to deliver today.",
      ]);
    }
    const blocos = [
      escolher([
        `Attention team: ${total} ${q(total, "case", "cases")} to deliver today.`,
        `Today we have ${total} ${q(total, "delivery", "deliveries")} on the list.`,
        `Lab update: ${total} ${q(total, "job is", "jobs are")} due today.`,
      ]),
      nAtrasados === 0
        ? escolher([
            `All ${total} ${q(total, "is", "are")} on time.`,
            "Everything is on schedule.",
          ])
        : escolher([
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
        "Por hoy no hay nada pendiente de salida.",
      ]);
    }
    const blocos = [
      escolher([
        `Atención, laboratorio: hoy hay ${total} ${q(total, "trabajo", "trabajos")} para entregar.`,
        `Hoy tenemos ${total} ${q(total, "entrega", "entregas")} en la lista.`,
        `Aviso del día: ${total} ${q(total, "caso", "casos")} para salir hoy.`,
      ]),
      nAtrasados === 0
        ? escolher([
            `Los ${total} están a tiempo.`,
            "Todo está dentro del plazo.",
          ])
        : escolher([
            `${noPrazo} a tiempo y ${nAtrasados} en retraso.`,
            `A tiempo: ${noPrazo}. En retraso: ${nAtrasados}.`,
          ]),
      listarAtrasadosFala(atrasados, "es"),
    ].filter(Boolean);
    return embaralhar(blocos).join(" ");
  }

  if (total === 0) {
    return escolher([
      "Por hoje, não há nenhum trabalho para entregar.",
      "A lista de entregas de hoje está vazia.",
      "Nada para sair hoje.",
    ]);
  }

  const blocoTotal = escolher([
    `Atenção, laboratório: hoje são ${total} ${q(total, "trabalho", "trabalhos")} para entregar.`,
    `Equipe, temos ${total} ${q(total, "entrega", "entregas")} na lista de hoje.`,
    `Passando o aviso: ${total} ${q(total, "caso", "casos")} para sair ainda hoje.`,
    `Hoje a produção tem ${total} ${q(total, "trabalho", "trabalhos")} na entrega.`,
  ]);

  const blocoPrazo = escolher([
    nAtrasados === 0
      ? `Todos os ${total} estão no prazo.`
      : noPrazo === 0
        ? `Os ${nAtrasados} já passaram do horário.`
        : `Desses, ${noPrazo} ${q(noPrazo, "ainda está", "ainda estão")} no prazo e ${nAtrasados} em atraso.`,
    nAtrasados === 0
      ? "Nenhum atraso no momento."
      : `No prazo: ${noPrazo}. Em atraso: ${nAtrasados}.`,
    nAtrasados === 0
      ? "Tudo dentro do horário combinado."
      : `${noPrazo} no prazo. ${nAtrasados} ${q(nAtrasados, "já atrasou", "já atrasaram")}.`,
  ]);

  const blocoAtrasados = listarAtrasadosFala(atrasados, "pt");
  let blocos = [blocoTotal, blocoPrazo, blocoAtrasados].filter((bloco) => bloco.trim());
  if (blocos.length > 2 && Math.random() < 0.35) {
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
        `${item.paciente} is overdue, due ${quando}, work order ${item.numeroOs}.`,
        `Overdue case: ${item.paciente}, due ${quando}.`,
        `Please check ${item.paciente}, scheduled ${quando}.`,
      ]);
    }
    if (locale === "es") {
      return escolher([
        `${item.paciente} está en retraso, ${quando}, orden ${item.numeroOs}.`,
        `Pendiente atrasado: ${item.paciente}, ${quando}.`,
        `Revisen el caso de ${item.paciente}, programado ${quando}.`,
      ]);
    }
    return escolher([
      `${item.paciente} está em atraso, combinado ${quando}, O.S. ${item.numeroOs}.`,
      `Em atraso: ${item.paciente}, ${quando}.`,
      `Conferam ${item.paciente}, era para ${quando}.`,
      `${item.paciente} ainda não saiu, prazo ${quando}.`,
    ]);
  });

  const intro =
    locale === "en"
      ? escolher(["Overdue jobs:", "These cases are late:", "Please review:"])
      : locale === "es"
        ? escolher(["Casos en retraso:", "Atención a estos atrasos:", "Revisen:"])
        : escolher([
            "Casos em atraso:",
            "Atenção aos atrasos:",
            "Vamos aos que passaram do prazo:",
          ]);

  let texto = `${intro} ${partes.join(" ")}`;
  if (resto > 0) {
    if (locale === "en") texto += ` And ${resto} more overdue ${q(resto, "case", "cases")}.`;
    else if (locale === "es") texto += ` Y ${resto} ${q(resto, "atraso más", "atrasos más")}.`;
    else texto += ` E mais ${resto} ${q(resto, "caso em atraso", "casos em atraso")}.`;
  }
  return texto;
}

function langLocutor(locale: Locale) {
  if (locale === "en") return "en-US";
  if (locale === "es") return "es-MX";
  return "pt-BR";
}

function normalizarLang(lang: string) {
  return lang.toLowerCase().replace(/_/g, "-");
}

function vozPareceMasculina(nome: string) {
  return /male|masculin|\bman\b|daniel|antonio|antônio|felipe|ricardo|rafael|bruno|google uk english male|microsoft david|microsoft george|microsoft jorge|microsoft pablo/i.test(
    nome
  );
}

function vozPareceFeminina(nome: string) {
  return /female|feminina|woman|girl|maria|francisca|luciana|heloisa|heloísa|helena|elvira|paulina|sabina|thalita|camila|vitória|vitoria|zira|samantha|karen|moira|tessa|fiona|veena|lekha|microsoft maria|microsoft francisca|microsoft sabina|microsoft elvira|google português do brasil|google portugues do brasil|português do brasil|portugues do brasil|google español|google espanol|español de méxico|espanol de mexico/i.test(
    nome
  );
}

function pontuarVozFeminina(voz: SpeechSynthesisVoice, locale: Locale) {
  const nome = voz.name.toLowerCase();
  const lang = normalizarLang(voz.lang || "");
  const alvo = normalizarLang(langLocutor(locale));
  const prefixo = alvo.slice(0, 2);
  let pontos = 0;

  if (lang === alvo) pontos += 40;
  else if (lang.startsWith(`${prefixo}-`) || lang === prefixo) pontos += 12;
  else pontos -= 50;

  if (locale === "pt" && (lang === "pt-pt" || /portugal|european portuguese|português de portugal/i.test(nome))) {
    pontos -= 40;
  }
  if (locale === "pt" && (lang === "pt-br" || /brasil|brazil/i.test(nome))) pontos += 16;
  if (locale === "en" && (lang === "en-us" || /united states|american/i.test(nome))) pontos += 14;
  if (locale === "en" && (lang === "en-gb" || /british|uk english/i.test(nome))) pontos -= 10;
  if (locale === "es" && (lang === "es-mx" || lang === "es-us" || lang === "es-419" || /m[eé]xico|mexican|latin america/i.test(nome))) {
    pontos += 16;
  }
  if (locale === "es" && lang === "es-es") pontos -= 8;

  if (vozPareceFeminina(nome)) pontos += 14;
  if (vozPareceMasculina(nome) && !vozPareceFeminina(nome)) pontos -= 22;
  if (/natural|online|neural|wavenet|studio|premium|enhanced/i.test(nome)) pontos += 6;
  if (voz.localService) pontos += 1;
  return pontos;
}

function escolherVoz(locale: Locale) {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const vozes = window.speechSynthesis.getVoices();
  if (!vozes.length) return null;

  const prefixo = langLocutor(locale).slice(0, 2).toLowerCase();
  const doIdioma = vozes.filter((voz) => normalizarLang(voz.lang || "").startsWith(prefixo));
  const pool = doIdioma.length > 0 ? doIdioma : vozes;
  const femininas = pool.filter(
    (voz) => vozPareceFeminina(voz.name) || !vozPareceMasculina(voz.name)
  );
  const base = femininas.length > 0 ? femininas : pool;
  const ordenadas = [...base].sort(
    (a, b) => pontuarVozFeminina(b, locale) - pontuarVozFeminina(a, locale)
  );
  return ordenadas[0] ?? null;
}

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
    if (hora === 12) return escolher(["It's noon.", "It's 12 PM."]);
    if (hora === 0) return escolher(["It's midnight.", "It's 12 AM."]);
    const h12 = ((hora + 11) % 12) + 1;
    const sufixo = hora < 12 ? "AM" : "PM";
    return escolher([`It's ${h12} ${sufixo}.`, `The time is ${h12} ${sufixo}.`]);
  }

  if (locale === "es") {
    if (hora === 1) return escolher(["Es la 1 de la mañana.", "Es la 1 en punto."]);
    if (hora === 12) return escolher(["Es mediodía.", "Son las 12 en punto."]);
    if (hora === 13) return escolher(["Es la 1 de la tarde.", "Es la 1 en punto."]);
    if (hora < 12) return escolher([`Son las ${hora} de la mañana.`, `Marca las ${hora}.`]);
    if (hora < 19) {
      const h = hora - 12;
      return escolher([`Son las ${h} de la tarde.`, `Marca las ${hora} horas.`]);
    }
    return escolher([`Son las ${hora - 12} de la noche.`, `Marca las ${hora} horas.`]);
  }

  if (hora === 12) {
    return escolher(["São meio-dia.", "Meio-dia em ponto.", "Equipe, meio-dia."]);
  }
  if (hora === 18) {
    return escolher(["São 18 horas.", "18 horas em ponto.", "Equipe, 18 horas."]);
  }

  const periodo = hora < 12 ? "da manhã" : "da tarde";
  return escolher([
    `São ${hora} horas.`,
    `Agora são ${hora} ${periodo}.`,
    `Equipe, ${hora} horas.`,
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
      utt.rate = locale === "en" ? 1.08 : 1.12;
      utt.pitch = 1.02;
      utt.volume = 1;
      const voz = escolherVoz(locale);
      if (voz) {
        utt.voice = voz;
        utt.lang = voz.lang || utt.lang;
      }
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
