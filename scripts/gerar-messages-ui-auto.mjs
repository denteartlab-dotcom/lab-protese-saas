#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function slugify(texto) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase()
    .slice(0, 55);
}

function esc(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function extrairStrings() {
  const strings = new Set();
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (["node_modules", ".next"].includes(entry.name)) continue;
        walk(full);
      } else if (/\.tsx?$/.test(entry.name)) {
        const content = fs.readFileSync(full, "utf8");
        const patterns = [
          /\blabel="([^"]{1,150})"/g,
          /\blabel='([^']{1,150})'/g,
          /\bplaceholder="([^"]{1,150})"/g,
          /\bplaceholder='([^']{1,150})'/g,
          /\btitle="([^"]{1,150})"/g,
          /\btitle='([^']{1,150})'/g,
          /\bmensagem="([^"]{1,200})"/g,
          /\bmensagem='([^']{1,200})'/g,
          /\bemptyMessage="([^"]{1,120})"/g,
          /\baria-label="([^"]{1,80})"/g,
          /alert\(\s*"([^"]{4,220})"/g,
          /alert\(\s*'([^']{4,220})'/g,
          /=\s*"([^"]{2,80})"\s*\?\s*"Carregando/g,
          /mensagem\s*=\s*"([^"]+)"/g,
          /labelConfirmar\s*=\s*"([^"]+)"/g,
          /labelCancelar\s*=\s*"([^"]+)"/g,
          /labelCancelar\s*=\s*'([^']+)'/g,
          /\b(?:placeholder|emptyMessage|mensagem|titulo)\s*=\s*"([^"]{1,200})"/g,
          /\b(?:placeholder|emptyMessage|mensagem|titulo)\s*=\s*'([^']{1,200})'/g,
          /(?:placeholder|emptyMessage|mensagem)\s*=\s*\{?"([^"]{2,120})"?\}/g,
          />([A-Za-zÀ-ú][^<>{}\n]{2,100})</g,
        ];
        for (const re of patterns) {
          let m;
          while ((m = re.exec(content))) {
            const s = m[1].trim();
            if (!s.includes("${") && !s.includes("{") && !s.startsWith("t(")) strings.add(s);
          }
        }
      }
    }
  }
  walk(path.join(root, "src"));
  return [...strings].sort();
}

/** Substituições palavra a palavra para EN. */
function paraEn(pt) {
  let s = pt;
  const map = [
    [/Não foi possível/g, "Could not"],
    [/não foi possível/g, "could not"],
    [/Não/g, "Not"],
    [/não/g, "not"],
    [/Informe/g, "Enter"],
    [/informe/g, "enter"],
    [/Selecione/g, "Select"],
    [/selecione/g, "select"],
    [/Cadastre/g, "Register"],
    [/Adicionar/g, "Add"],
    [/Excluir/g, "Delete"],
    [/Gravar/g, "Save"],
    [/Salvar/g, "Save"],
    [/Cancelar/g, "Cancel"],
    [/Buscar/g, "Search"],
    [/Carregando/g, "Loading"],
    [/Cliente/g, "Client"],
    [/Paciente/g, "Patient"],
    [/Serviço/g, "Service"],
    [/Serviços/g, "Services"],
    [/Produto/g, "Product"],
    [/Produtos/g, "Products"],
    [/Fatura/g, "Invoice"],
    [/Faturas/g, "Invoices"],
    [/Despesa/g, "Expense"],
    [/Despesas/g, "Expenses"],
    [/Recebimento/g, "Receipt"],
    [/Colaborador/g, "Staff"],
    [/Fornecedor/g, "Supplier"],
    [/Laboratório/g, "Laboratory"],
    [/Observação/g, "Note"],
    [/Observações/g, "Notes"],
    [/Situação/g, "Status"],
    [/Quantidade/g, "Quantity"],
    [/Valor/g, "Amount"],
    [/Vencimento/g, "Due date"],
    [/Data de/g, "Date of"],
    [/Data /g, "Date "],
    [/Nome/g, "Name"],
    [/Endereço/g, "Address"],
    [/Telefone/g, "Phone"],
    [/Celular/g, "Mobile"],
    [/Bairro/g, "Neighborhood"],
    [/Cidade/g, "City"],
    [/Todos/g, "All"],
    [/Tente novamente/g, "Try again"],
    [/ordem de serviço/g, "work order"],
    [/Ordem de Serviço/g, "Work Order"],
    [/Tente/g, "Try"],
  ];
  for (const [re, rep] of map) s = s.replace(re, rep);
  return s;
}

function paraEs(pt) {
  let s = pt;
  const map = [
    [/Não foi possível/g, "No fue posible"],
    [/não foi possível/g, "no fue posible"],
    [/Informe/g, "Ingrese"],
    [/informe/g, "ingrese"],
    [/Selecione/g, "Seleccione"],
    [/selecione/g, "seleccione"],
    [/Cadastre/g, "Registre"],
    [/Adicionar/g, "Agregar"],
    [/Excluir/g, "Eliminar"],
    [/Gravar/g, "Guardar"],
    [/Salvar/g, "Guardar"],
    [/Cancelar/g, "Cancelar"],
    [/Buscar/g, "Buscar"],
    [/Carregando/g, "Cargando"],
    [/Cliente/g, "Cliente"],
    [/Paciente/g, "Paciente"],
    [/Serviço/g, "Servicio"],
    [/Serviços/g, "Servicios"],
    [/Produto/g, "Producto"],
    [/Produtos/g, "Productos"],
    [/Fatura/g, "Factura"],
    [/Faturas/g, "Facturas"],
    [/Despesa/g, "Gasto"],
    [/Despesas/g, "Gastos"],
    [/Recebimento/g, "Cobro"],
    [/Colaborador/g, "Colaborador"],
    [/Fornecedor/g, "Proveedor"],
    [/Laboratório/g, "Laboratorio"],
    [/Observação/g, "Observación"],
    [/Observações/g, "Observaciones"],
    [/Situação/g, "Situación"],
    [/Quantidade/g, "Cantidad"],
    [/Valor/g, "Valor"],
    [/Vencimento/g, "Vencimiento"],
    [/Data de/g, "Fecha de"],
    [/Data /g, "Fecha "],
    [/Nome/g, "Nombre"],
    [/Endereço/g, "Dirección"],
    [/Telefone/g, "Teléfono"],
    [/Celular/g, "Celular"],
    [/Bairro/g, "Barrio"],
    [/Cidade/g, "Ciudad"],
    [/Todos/g, "Todos"],
    [/Tente novamente/g, "Intente nuevamente"],
    [/ordem de serviço/g, "orden de servicio"],
    [/Ordem de Serviço/g, "Orden de Servicio"],
  ];
  for (const [re, rep] of map) s = s.replace(re, rep);
  return s;
}

const strings = extrairStrings();
const pt = {};
const en = {};
const es = {};
const usados = new Set();

for (const texto of strings) {
  if (!texto || texto.length < 2) continue;
  if (/^https?:\/\//.test(texto)) continue;
  if (/^[A-Z_0-9.]+$/.test(texto) && texto.length > 15) continue;
  let base = `ui.auto.${slugify(texto)}`;
  let n = 0;
  while (usados.has(base)) {
    n++;
    base = `ui.auto.${slugify(texto)}_${n}`;
  }
  usados.add(base);
  pt[base] = texto;
  en[base] = paraEn(texto);
  es[base] = paraEs(texto);
}

function objToTs(obj, name) {
  const lines = Object.entries(obj).map(([k, v]) => `  "${k}": "${esc(v)}",`);
  return `export const ${name} = {\n${lines.join("\n")}\n} as const;\n`;
}

const out = `/** Gerado por scripts/gerar-messages-ui-auto.mjs */\n\n${objToTs(pt, "messagesUiAutoPt")}\n${objToTs(en, "messagesUiAutoEn")}\n${objToTs(es, "messagesUiAutoEs")}\n`;

fs.writeFileSync(path.join(root, "src/lib/i18n/messages-ui-auto.ts"), out, "utf8");
console.log("Chaves:", Object.keys(pt).length);
