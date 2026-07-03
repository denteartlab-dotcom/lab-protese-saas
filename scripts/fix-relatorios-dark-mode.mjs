/**
 * Adiciona variantes dark: em classes claras dos relatórios.
 * Só aplica se a variante dark correspondente ainda não existir no mesmo token.
 */
import { readFileSync, writeFileSync } from "fs";

const files = [
  "src/components/relatorios/MargemContribuicaoConteudo.tsx",
  "src/components/relatorios/RelatorioProducaoConteudo.tsx",
  "src/components/relatorios/CurvaAbcClientesConteudo.tsx",
  "src/components/relatorios/RelatorioEstoqueConteudo.tsx",
  "src/components/relatorios/RelatorioRecibosEmitidosConteudo.tsx",
  "src/components/relatorios/RelatorioLogsAuditoriaConteudo.tsx",
  "src/components/relatorios/DashboardGerencialConteudo.tsx",
  "src/components/relatorios/RelatorioFinanceiroGeralConteudo.tsx",
  "src/components/relatorios/ClientesPrejuizoConteudo.tsx",
  "src/components/relatorios/ServicosNaoConcluidosConteudo.tsx",
  "src/components/relatorios/VerAlteracoesAuditoriaModal.tsx",
  "src/components/relatorios/BadgeTipoAlteracaoLog.tsx",
];

/** [classe clara, classe dark a acrescentar] */
const pares = [
  ["bg-white", "dark:bg-slate-900"],
  ["bg-slate-50", "dark:bg-slate-800/60"],
  ["bg-slate-100", "dark:bg-slate-800"],
  ["bg-[#ffffff]", "dark:bg-slate-900"],
  ["bg-[#fafafa]", "dark:bg-slate-800/70"],
  ["bg-[#f9fafb]", "dark:bg-slate-800/70"],
  ["bg-[#f5f6f8]", "dark:bg-slate-800"],
  ["bg-[#f3f4f6]", "dark:bg-slate-800"],
  ["bg-[#f4f3fb]", "dark:bg-slate-800"],
  ["bg-[#f8fafc]", "dark:bg-slate-800"],
  ["bg-[#eef2ff]", "dark:bg-slate-800"],
  ["bg-[#f0f9ff]", "dark:bg-slate-800"],
  ["border-slate-100", "dark:border-slate-700"],
  ["border-slate-200", "dark:border-slate-700"],
  ["border-slate-300", "dark:border-slate-600"],
  ["border-[#e5e7eb]", "dark:border-slate-700"],
  ["border-[#e0e0e0]", "dark:border-slate-700"],
  ["border-[#e8e8e8]", "dark:border-slate-700"],
  ["border-[#d1d5db]", "dark:border-slate-600"],
  ["text-slate-900", "dark:text-slate-100"],
  ["text-slate-800", "dark:text-slate-100"],
  ["text-slate-700", "dark:text-slate-200"],
  ["text-slate-600", "dark:text-slate-300"],
  ["text-slate-500", "dark:text-slate-400"],
  ["text-slate-400", "dark:text-slate-500"],
  ["text-[#111827]", "dark:text-slate-100"],
  ["text-[#1f2937]", "dark:text-slate-100"],
  ["text-[#374151]", "dark:text-slate-200"],
  ["text-[#4b5563]", "dark:text-slate-300"],
  ["text-[#6b7280]", "dark:text-slate-400"],
  ["text-[#9ca3af]", "dark:text-slate-500"],
  ["text-[#555566]", "dark:text-slate-300"],
  ["divide-slate-200", "dark:divide-slate-700"],
  ["ring-slate-200", "dark:ring-slate-700"],
  ["placeholder:text-slate-400", "dark:placeholder:text-slate-500"],
];

function aplicarDark(conteudo) {
  let out = conteudo;
  for (const [claro, escuro] of pares) {
    // token exato em className (evita bg-white/10 e já com dark:)
    const re = new RegExp(
      `(?<![\\w-])${claro.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w/-])`,
      "g"
    );
    out = out.replace(re, (match, offset) => {
      const depois = out.slice(offset, offset + match.length + escuro.length + 8);
      if (depois.includes(escuro)) return match;
      // se já tem qualquer dark:bg / dark:text no mesmo atributo próximo, ainda adiciona
      // a variante específica se não existir
      const janela = out.slice(Math.max(0, offset - 20), offset + match.length + 80);
      if (janela.includes(escuro)) return match;
      return `${match} ${escuro}`;
    });
  }
  return out;
}

for (const file of files) {
  const antes = readFileSync(file, "utf8");
  const depois = aplicarDark(antes);
  if (antes !== depois) {
    writeFileSync(file, depois);
    console.log("ok", file);
  } else {
    console.log("skip", file);
  }
}
