import { nomeExibicaoLaboratorio, carregarConfigLaboratorio } from "@/lib/configuracoes-lab";
import type { LayoutEtiquetaEntrega } from "@/lib/configuracoes-etiqueta-entrega";
import type { EntregaControle } from "@/lib/controle-entregas";

export type EnderecoEtiquetaEnvio = {
  nome: string;
  rua?: string;
  numero?: string;
  bairro?: string;
  complemento?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  telefone?: string;
};

export type TextosEtiquetaEnvio = {
  titulo: string;
  destinatario: string;
  remetente: string;
  os: string;
  cep: string;
  remetenteSemCadastro: string;
  imprimir: string;
  fechar: string;
};

/** Folha A4, bobina 80mm ou etiqueta compacta de envio. */
export type FormatoEtiquetaEnvio = "a4" | "termica" | "etiqueta";

/** Modelo 1 ocupa a folha inteira. Modelo 2 coloca duas etiquetas para recortar. */
export type ModeloEtiquetaA4 = "modelo1" | "modelo2";

export type OpcoesEtiquetaEnvio = {
  formato?: FormatoEtiquetaEnvio;
  modeloA4?: ModeloEtiquetaA4;
  duasVias?: boolean;
  layout?: Partial<LayoutEtiquetaEntrega>;
  preview?: boolean;
};

export function linhasEnderecoEtiqueta(
  endereco: EnderecoEtiquetaEnvio,
  rotuloCep = "CEP",
  campos?: { cep?: boolean; telefone?: boolean }
) {
  const linhas: string[] = [];
  const nome = endereco.nome.trim();
  if (nome) linhas.push(nome);
  const ruaNumero = [endereco.rua, endereco.numero]
    .map((parte) => (parte || "").trim())
    .filter(Boolean)
    .join(", ");
  if (ruaNumero) linhas.push(ruaNumero);
  const complemento = (endereco.complemento || "").trim();
  if (complemento) linhas.push(complemento);
  const bairro = (endereco.bairro || "").trim();
  if (bairro) linhas.push(bairro);
  const cidadeUf = [endereco.cidade, endereco.uf]
    .map((parte) => (parte || "").trim())
    .filter(Boolean)
    .join(" - ");
  if (cidadeUf) linhas.push(cidadeUf);
  const cep = (endereco.cep || "").trim();
  if (cep && campos?.cep !== false) linhas.push(`${rotuloCep} ${cep}`);
  const telefone = (endereco.telefone || "").trim();
  if (telefone && campos?.telefone !== false) linhas.push(telefone);
  return linhas;
}

export function destinatarioDaEntrega(entrega: Pick<
  EntregaControle,
  | "destinatario"
  | "nomeDestinatario"
  | "rua"
  | "numeroEndereco"
  | "bairro"
  | "complemento"
  | "cidade"
  | "uf"
  | "cep"
>): EnderecoEtiquetaEnvio {
  return {
    nome: (entrega.nomeDestinatario || entrega.destinatario || "").trim(),
    rua: entrega.rua,
    numero: entrega.numeroEndereco,
    bairro: entrega.bairro,
    complemento: entrega.complemento,
    cidade: entrega.cidade,
    uf: entrega.uf,
    cep: entrega.cep,
  };
}

export function remetenteDoLaboratorio(): EnderecoEtiquetaEnvio {
  const cfg = carregarConfigLaboratorio();
  const telefone = [cfg.whatsapp, cfg.telefoneComercial, cfg.celular]
    .map((parte) => (parte || "").trim())
    .find(Boolean);
  return {
    nome: nomeExibicaoLaboratorio(cfg),
    rua: cfg.rua,
    numero: cfg.numero,
    bairro: cfg.bairro,
    complemento: cfg.complemento,
    cidade: cfg.cidade,
    uf: cfg.uf,
    cep: cfg.cep,
    telefone,
  };
}

function escapeHtml(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function blocoEndereco(
  titulo: string,
  endereco: EnderecoEtiquetaEnvio,
  vazio: string,
  rotuloCep: string,
  classe: string,
  campos?: { cep?: boolean; telefone?: boolean }
) {
  const linhas = linhasEnderecoEtiqueta(endereco, rotuloCep, campos);
  const corpo =
    linhas.length > 0
      ? linhas.map((linha) => `<p>${escapeHtml(linha)}</p>`).join("")
      : `<p class="vazio">${escapeHtml(vazio)}</p>`;
  return `<section class="${classe}"><h2>${escapeHtml(titulo)}</h2>${corpo}</section>`;
}

function estilosEtiqueta(formato: FormatoEtiquetaEnvio) {
  const pagina =
    formato === "a4"
      ? "@page { size: A4; margin: 8mm; }"
      : formato === "termica"
        ? "@page { size: 80mm 140mm; margin: 3mm; }"
        : "@page { size: 100mm 150mm; margin: 4mm; }";
  return `
    * { box-sizing: border-box; }
    body { margin: 0; background: #f1f5f9; color: #0f172a; font-family: Arial, Helvetica, sans-serif; }
    .acoes { display: flex; gap: 8px; justify-content: center; padding: 16px; }
    button { border: 0; border-radius: 6px; background: #2563eb; color: #fff; font: 600 13px Arial, sans-serif; padding: 8px 14px; cursor: pointer; }
    button.secundario { background: #e2e8f0; color: #334155; }
    h1 { display: none; }
    h2 { margin: 0 0 4mm; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #475569; }
    p { margin: 0 0 1.5mm; line-height: 1.3; }
    section p:first-of-type { font-weight: 700; }
    .os { margin: 0 0 4mm; font-weight: 700; }
    .vazio { font-weight: 400 !important; color: #64748b; }
    .folha { margin: 0 auto 16px; background: transparent; }
    .etiqueta { background: #fff; border: 2px solid #0f172a; }
    body.sem-borda .etiqueta { border: 0; }
    .remetente { border-top: 1px dashed #94a3b8; }
    .via { break-before: page; page-break-before: always; }
    body.formato-etiqueta .etiqueta { width: 100mm; min-height: 140mm; padding: 8mm; }
    body.formato-etiqueta p { font-size: calc(14px * var(--escala, 1)); }
    body.formato-etiqueta section p:first-of-type { font-size: calc(18px * var(--escala, 1)); }
    body.formato-etiqueta .os { font-size: calc(12px * var(--escala, 1)); }
    body.formato-etiqueta section { padding: 4mm 0; }
    body.formato-termica .etiqueta { width: 72mm; min-height: 120mm; padding: 3mm; }
    body.formato-termica p { font-size: calc(12px * var(--escala, 1)); }
    body.formato-termica section p:first-of-type { font-size: calc(16px * var(--escala, 1)); }
    body.formato-termica .os { font-size: calc(11px * var(--escala, 1)); }
    body.formato-termica section { padding: 3mm 0; }
    body.formato-a4 .etiqueta { width: 190mm; min-height: 270mm; padding: 12mm 14mm; display: flex; flex-direction: column; }
    body.formato-a4 .destinatario { flex: 1.35; }
    body.formato-a4 .remetente { flex: 0.85; margin-top: 6mm; padding-top: 8mm; border-top-width: 2px; }
    body.formato-a4 h2 { font-size: calc(13px * var(--escala, 1)); }
    body.formato-a4 p { font-size: calc(20px * var(--escala, 1)); margin-bottom: 2mm; }
    body.formato-a4 section p:first-of-type { font-size: calc(32px * var(--escala, 1)); }
    body.formato-a4 .os { font-size: calc(16px * var(--escala, 1)); margin-bottom: 8mm; }
    body.formato-a4.modelo-duas .folha { width: 190mm; min-height: 270mm; display: flex; flex-direction: column; justify-content: space-between; gap: 6mm; }
    body.formato-a4.modelo-duas .etiqueta { min-height: 128mm; padding: 7mm 8mm; }
    body.formato-a4.modelo-duas p { font-size: calc(16px * var(--escala, 1)); }
    body.formato-a4.modelo-duas section p:first-of-type { font-size: calc(22px * var(--escala, 1)); }
    body.formato-a4.modelo-duas .os { font-size: calc(13px * var(--escala, 1)); margin-bottom: 3mm; }
    body.formato-a4.modelo-duas .remetente { margin-top: 3mm; padding-top: 3mm; }
    @media print {
      body { background: #fff; }
      .acoes { display: none; }
      .folha { margin: 0; }
      ${pagina}
    }
  `;
}

function etiquetaHtml(
  textos: TextosEtiquetaEnvio,
  destinatario: EnderecoEtiquetaEnvio,
  remetente: EnderecoEtiquetaEnvio,
  osHtml: string,
  layout?: Partial<LayoutEtiquetaEntrega>
) {
  const campos = { cep: layout?.exibirCep !== false, telefone: layout?.exibirTelefone !== false };
  const destino =
    layout?.exibirDestinatario === false
      ? ""
      : blocoEndereco(textos.destinatario, destinatario, "", textos.cep, "destinatario", campos);
  const origem =
    layout?.exibirRemetente === false
      ? ""
      : blocoEndereco(
          textos.remetente,
          remetente,
          textos.remetenteSemCadastro,
          textos.cep,
          "remetente",
          campos
        );
  return `<article class="etiqueta">
    <h1>${escapeHtml(textos.titulo)}</h1>
    ${osHtml}
    ${destino}
    ${origem}
  </article>`;
}

export function htmlEtiquetaEnvio(dados: {
  textos: TextosEtiquetaEnvio;
  destinatario: EnderecoEtiquetaEnvio;
  remetente: EnderecoEtiquetaEnvio;
  numeroOs?: string;
  opcoes?: OpcoesEtiquetaEnvio;
}) {
  const formato = dados.opcoes?.formato ?? "etiqueta";
  const modeloA4 = dados.opcoes?.modeloA4 ?? "modelo1";
  const duasVias = Boolean(dados.opcoes?.duasVias);
  const layout = dados.opcoes?.layout;
  const escala = Math.min(22, Math.max(10, Number(layout?.tamanhoFonte) || 14)) / 14;
  const os = (dados.numeroOs || "").trim();
  const osHtml =
    os && layout?.exibirOs !== false
      ? `<p class="os">${escapeHtml(dados.textos.os)} ${escapeHtml(os)}</p>`
      : "";
  const miolo = etiquetaHtml(dados.textos, dados.destinatario, dados.remetente, osHtml, layout);
  const etiquetasNaFolha = formato === "a4" && modeloA4 === "modelo2" ? `${miolo}${miolo}` : miolo;
  const folha = `<section class="folha">${etiquetasNaFolha}</section>`;
  const folhas = duasVias ? `${folha}<section class="folha via">${etiquetasNaFolha}</section>` : folha;
  const classeModelo = formato === "a4" && modeloA4 === "modelo2" ? " modelo-duas" : "";
  const semBorda = layout?.exibirBorda === false ? " sem-borda" : "";
  const acoes = dados.opcoes?.preview
    ? ""
    : `<div class="acoes">
    <button type="button" onclick="window.print()">${escapeHtml(dados.textos.imprimir)}</button>
    <button type="button" class="secundario" onclick="window.close()">${escapeHtml(dados.textos.fechar)}</button>
  </div>`;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(dados.textos.titulo)}</title>
  <style>${estilosEtiqueta(formato)}</style>
</head>
<body class="formato-${formato}${classeModelo}${semBorda}" style="--escala:${escala}">
  ${acoes}
  ${folhas}
</body>
</html>`;
}

function htmlDaEtiqueta(
  entrega: EntregaControle,
  textos: TextosEtiquetaEnvio,
  opcoes?: OpcoesEtiquetaEnvio
) {
  return htmlEtiquetaEnvio({
    textos,
    destinatario: destinatarioDaEntrega(entrega),
    remetente: remetenteDoLaboratorio(),
    numeroOs: entrega.numeroOs,
    opcoes,
  });
}

function escreverEtiqueta(documento: Document, html: string) {
  documento.open();
  documento.write(html);
  documento.close();
}

function imprimirJanela(janela: Window) {
  window.setTimeout(() => {
    try {
      janela.focus();
      janela.print();
    } catch {
      /* a página da etiqueta continua com o botão Imprimir */
    }
  }, 250);
}

function caixaIframe(formato: FormatoEtiquetaEnvio) {
  if (formato === "a4") return "left:-220mm;width:210mm;height:297mm;";
  if (formato === "termica") return "left:-90mm;width:80mm;height:140mm;";
  return "left:-120mm;width:100mm;height:150mm;";
}

/** Imprime na própria página quando o navegador bloqueia a nova aba. */
function imprimirEtiquetaNoIframe(html: string, formato: FormatoEtiquetaEnvio) {
  if (!document.body) return false;
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  // Fora da tela, com tamanho real: iframe invisível (opacity 0) imprime em branco no Chrome.
  iframe.style.cssText = `position:fixed;top:0;border:0;${caixaIframe(formato)}`;
  iframe.srcdoc = html;
  const aoCarregar = () => {
    const janela = iframe.contentWindow;
    if (janela) imprimirJanela(janela);
    const remover = () => window.setTimeout(() => iframe.remove(), 400);
    janela?.addEventListener("afterprint", remover, { once: true });
    window.setTimeout(remover, 60_000);
  };
  iframe.addEventListener("load", aoCarregar, { once: true });
  document.body.appendChild(iframe);
  return true;
}

export function imprimirEtiquetaEntrega(
  entrega: EntregaControle,
  textos: TextosEtiquetaEnvio,
  opcoes?: OpcoesEtiquetaEnvio
) {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const formato = opcoes?.formato ?? "etiqueta";
  const html = htmlDaEtiqueta(entrega, textos, opcoes);

  // Sem "noopener": com essa opção o Chrome devolve null e a etiqueta não é escrita.
  let janela: Window | null = null;
  try {
    janela = window.open("about:blank", "_blank");
  } catch {
    janela = null;
  }
  if (!janela) return imprimirEtiquetaNoIframe(html, formato);

  try {
    escreverEtiqueta(janela.document, html);
  } catch {
    try {
      janela.close();
    } catch {
      /* a aba pode já ter sido fechada */
    }
    return imprimirEtiquetaNoIframe(html, formato);
  }
  try {
    janela.opener = null;
  } catch {
    /* a aba já está isolada */
  }
  imprimirJanela(janela);
  return true;
}
