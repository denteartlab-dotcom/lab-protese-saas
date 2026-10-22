import { nomeExibicaoLaboratorio, carregarConfigLaboratorio } from "@/lib/configuracoes-lab";
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

export function linhasEnderecoEtiqueta(endereco: EnderecoEtiquetaEnvio, rotuloCep = "CEP") {
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
  if (cep) linhas.push(`${rotuloCep} ${cep}`);
  const telefone = (endereco.telefone || "").trim();
  if (telefone) linhas.push(telefone);
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
  rotuloCep: string
) {
  const linhas = linhasEnderecoEtiqueta(endereco, rotuloCep);
  const corpo =
    linhas.length > 0
      ? linhas.map((linha) => `<p>${escapeHtml(linha)}</p>`).join("")
      : `<p class="vazio">${escapeHtml(vazio)}</p>`;
  return `<section><h2>${escapeHtml(titulo)}</h2>${corpo}</section>`;
}

export function htmlEtiquetaEnvio(dados: {
  textos: TextosEtiquetaEnvio;
  destinatario: EnderecoEtiquetaEnvio;
  remetente: EnderecoEtiquetaEnvio;
  numeroOs?: string;
}) {
  const os = (dados.numeroOs || "").trim();
  const osHtml = os
    ? `<p class="os">${escapeHtml(dados.textos.os)} ${escapeHtml(os)}</p>`
    : "";
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(dados.textos.titulo)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f1f5f9; color: #0f172a; font-family: Arial, Helvetica, sans-serif; }
    .acoes { display: flex; gap: 8px; justify-content: center; padding: 16px; }
    button { border: 0; border-radius: 6px; background: #2563eb; color: #fff; font: 600 13px Arial, sans-serif; padding: 8px 14px; cursor: pointer; }
    button.secundario { background: #e2e8f0; color: #334155; }
    .folha { width: 100mm; min-height: 140mm; margin: 0 auto 24px; background: #fff; border: 2px solid #0f172a; padding: 8mm; }
    h1 { display: none; }
    h2 { margin: 0 0 6px; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #475569; }
    section { padding: 4mm 0; }
    section + section { border-top: 1px dashed #94a3b8; }
    p { margin: 0 0 3px; font-size: 14px; line-height: 1.35; }
    section p:first-of-type { font-size: 18px; font-weight: 700; }
    .os { margin: 0 0 8px; font-size: 12px; font-weight: 700; }
    .vazio { font-size: 12px !important; font-weight: 400 !important; color: #64748b; }
    @media print {
      body { background: #fff; }
      .acoes { display: none; }
      .folha { margin: 0; border-width: 1.5px; }
      @page { size: 100mm 150mm; margin: 4mm; }
    }
  </style>
</head>
<body>
  <div class="acoes">
    <button type="button" onclick="window.print()">${escapeHtml(dados.textos.imprimir)}</button>
    <button type="button" class="secundario" onclick="window.close()">${escapeHtml(dados.textos.fechar)}</button>
  </div>
  <article class="folha">
    <h1>${escapeHtml(dados.textos.titulo)}</h1>
    ${osHtml}
    ${blocoEndereco(dados.textos.destinatario, dados.destinatario, "", dados.textos.cep)}
    ${blocoEndereco(dados.textos.remetente, dados.remetente, dados.textos.remetenteSemCadastro, dados.textos.cep)}
  </article>
</body>
</html>`;
}

function htmlDaEtiqueta(entrega: EntregaControle, textos: TextosEtiquetaEnvio) {
  return htmlEtiquetaEnvio({
    textos,
    destinatario: destinatarioDaEntrega(entrega),
    remetente: remetenteDoLaboratorio(),
    numeroOs: entrega.numeroOs,
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

/** Imprime na própria página quando o navegador bloqueia a nova aba. */
function imprimirEtiquetaNoIframe(html: string) {
  if (!document.body) return false;
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  // Fora da tela, com tamanho real: iframe invisível (opacity 0) imprime em branco no Chrome.
  iframe.style.cssText =
    "position:fixed;left:-120mm;top:0;width:100mm;height:150mm;border:0;";
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
  textos: TextosEtiquetaEnvio
) {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const html = htmlDaEtiqueta(entrega, textos);

  // Sem "noopener": com essa opção o Chrome devolve null e a etiqueta não é escrita.
  let janela: Window | null = null;
  try {
    janela = window.open("about:blank", "_blank");
  } catch {
    janela = null;
  }
  if (!janela) return imprimirEtiquetaNoIframe(html);

  try {
    escreverEtiqueta(janela.document, html);
  } catch {
    try {
      janela.close();
    } catch {
      /* a aba pode já ter sido fechada */
    }
    return imprimirEtiquetaNoIframe(html);
  }
  try {
    janela.opener = null;
  } catch {
    /* a aba já está isolada */
  }
  imprimirJanela(janela);
  return true;
}
