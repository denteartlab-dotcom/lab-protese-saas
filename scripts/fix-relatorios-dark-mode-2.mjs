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
];

const pares = [
  ["bg-[#ececec]", "dark:bg-slate-700"],
  ["bg-[#e8e8e8]", "dark:bg-slate-700"],
  ["bg-[#f0f0f0]", "dark:bg-slate-800"],
  ["hover:bg-[#ececec]", "dark:hover:bg-slate-700"],
  ["hover:bg-[#f3f4f6]", "dark:hover:bg-slate-700"],
  ["hover:bg-slate-50", "dark:hover:bg-slate-800"],
  ["hover:bg-slate-100", "dark:hover:bg-slate-700"],
  ["border-[#f0f0f0]", "dark:border-slate-700"],
  ["text-[#d1d5db]", "dark:text-slate-600"],
];

function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

for (const file of files) {
  let out = readFileSync(file, "utf8");
  const antes = out;
  for (const [claro, escuro] of pares) {
    const re = new RegExp(`(?<![\\w-])${esc(claro)}(?![\\w/-])`, "g");
    out = out.replace(re, (match, offset, str) => {
      const janela = str.slice(offset, offset + match.length + escuro.length + 4);
      if (janela.includes(escuro)) return match;
      return `${match} ${escuro}`;
    });
  }
  // fundo da página dos relatórios
  out = out.replace(
    /bg-\[#f3f4f6\] dark:bg-slate-800/g,
    "bg-[#f3f4f6] dark:bg-slate-950"
  );
  // remove dark duplicado após print:bg-white
  out = out.replace(/print:bg-white dark:bg-slate-900/g, "print:bg-white");
  if (out !== antes) {
    writeFileSync(file, out);
    console.log("ok", file);
  }
}
