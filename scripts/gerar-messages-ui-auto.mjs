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
      } else if (/\.(tsx?|mjs)$/.test(entry.name)) {
        if (/[\\/]i18n[\\/]/.test(full) && /\.ts$/.test(entry.name)) continue;
        const content = fs.readFileSync(full, "utf8");
        const patterns = [
          /\blabel="([^"]{1,150})"/g,
          /\blabel='([^']{1,150})'/g,
          /\bplaceholder="([^"]{1,150})"/g,
          /\bplaceholder='([^']{1,150})'/g,
          /\btitle="([^"]{1,150})"/g,
          /\btitle='([^']{1,150})'/g,
          /\baviso="([^"]{1,200})"/g,
          /\baviso='([^']{1,200})'/g,
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
          />([A-Za-zÀ-ú0-9][^<>{}\n]{1,120})</g,
          /\bchildren:\s*"([^"]{2,120})"/g,
          /\bchildren:\s*'([^']{2,120})'/g,
          /pdf\.text\(\s*"([^"]{2,120})"/g,
          /pdf\.text\(\s*'([^']{2,120})'/g,
          /<strong>([^<]{2,80})<\/strong>/g,
          /<th>([^<]{1,40})<\/th>/g,
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

/** Substituições palavra a palavra para EN. Maiúsculas antes de title case. */
function paraEn(pt) {
  let s = pt;
  const map = [
    [/Não foi possível/g, "Could not"],
    [/não foi possível/g, "could not"],
    [/NOME/g, "NAME"],
    [/Nº/g, "No."],
    [/Relatórios/g, "Reports"],
    [/RELATÓRIOS/g, "REPORTS"],
    [/Início/g, "Home"],
    [/INÍCIO/g, "HOME"],
    [/Diário/g, "Daily"],
    [/DIÁRIO/g, "DAILY"],
    [/Mensal/g, "Monthly"],
    [/MENSAL/g, "MONTHLY"],
    [/Receitas/g, "Revenue"],
    [/RECEITAS/g, "REVENUE"],
    [/Despesas/g, "Expenses"],
    [/DESPESAS/g, "EXPENSES"],
    [/Período/g, "Period"],
    [/PERÍODO/g, "PERIOD"],
    [/Situação/g, "Status"],
    [/SITUAÇÃO/g, "STATUS"],
    [/Previsto/g, "Forecast"],
    [/PREVISTO/g, "FORECAST"],
    [/Realizado/g, "Actual"],
    [/REALIZADO/g, "ACTUAL"],
    [/Imprimir/g, "Print"],
    [/IMPRIMIR/g, "PRINT"],
    [/Exportar/g, "Export"],
    [/EXPORTAR/g, "EXPORT"],
    [/Importar/g, "Import"],
    [/IMPORTAR/g, "IMPORT"],
    [/Visualizar/g, "View"],
    [/VISUALIZAR/g, "VIEW"],
    [/Editar/g, "Edit"],
    [/EDITAR/g, "EDIT"],
    [/Ações/g, "Actions"],
    [/AÇÕES/g, "ACTIONS"],
    [/Orçamento/g, "Quote"],
    [/Orçamentos/g, "Quotes"],
    [/Estoque/g, "Stock"],
    [/ESTOQUE/g, "STOCK"],
    [/Cadastros/g, "Registers"],
    [/CADASTROS/g, "REGISTERS"],
    [/Colaboradores/g, "Staff"],
    [/Fornecedores/g, "Suppliers"],
    [/Entregadores/g, "Couriers"],
    [/Setores/g, "Sectors"],
    [/Etapas/g, "Stages"],
    [/Tabela de Preços/g, "Price list"],
    [/Fluxo de Caixa/g, "Cash flow"],
    [/Margem Contribuição/g, "Contribution margin"],
    [/Tempo de Produção/g, "Production time"],
    [/Controle Entregas/g, "Delivery control"],
    [/Recibos Emitidos/g, "Issued receipts"],
    [/Dashboard Gerencial/g, "Management dashboard"],
    [/Serviços Não Concluídos/g, "Unfinished services"],
    [/Clientes Negativos/g, "Negative clients"],
    [/Forma Pagamento/g, "Payment method"],
    [/Esta Semana/g, "This week"],
    [/Este Mês/g, "This month"],
    [/Próximos 30 dias/g, "Next 30 days"],
    [/Mostrar Todos/g, "Show all"],
    [/Outro Período/g, "Custom period"],
    [/Hoje/g, "Today"],
    [/Todas/g, "All"],
    [/TODAS/g, "ALL"],
    [/Conta/g, "Account"],
    [/CONTA/g, "ACCOUNT"],
    [/Tipo/g, "Type"],
    [/TIPO/g, "TYPE"],
    [/Total/g, "Total"],
    [/TOTAL/g, "TOTAL"],
    [/Gerando/g, "Generating"],
    [/Nenhum/g, "No"],
    [/encontrado/g, "found"],
    [/registro/g, "record"],
    [/registros/g, "records"],
    [/página/g, "page"],
    [/de /g, "of "],
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
    [/Recebimento/g, "Receipt"],
    [/Receita/g, "Revenue"],
    [/Colaborador/g, "Staff"],
    [/Fornecedor/g, "Supplier"],
    [/Laboratório/g, "Laboratory"],
    [/Observação/g, "Note"],
    [/Observações/g, "Notes"],
    [/Quantidade/g, "Quantity"],
    [/Valor/g, "Amount"],
    [/Vencimento/g, "Due date"],
    [/Data de/g, "Date of"],
    [/Data /g, "Date "],
    [/Data início/g, "Start date"],
    [/Data fim/g, "End date"],
    [/Nome/g, "Name"],
    [/Endereço/g, "Address"],
    [/Telefone/g, "Phone"],
    [/Celular/g, "Mobile"],
    [/Bairro/g, "Neighborhood"],
    [/Cidade/g, "City"],
    [/Todos/g, "All"],
    [/TODOS/g, "ALL"],
    [/Tente novamente/g, "Try again"],
    [/ordem de serviço/g, "work order"],
    [/Ordem de Serviço/g, "Work Order"],
    [/Tente/g, "Try"],
    [/Novo/g, "New"],
    [/NOVO/g, "NEW"],
    [/Categoria/g, "Category"],
    [/Custo/g, "Cost"],
    [/Movimentação/g, "Movement"],
    [/Histórico/g, "History"],
    [/Aguardando/g, "Pending"],
    [/Aprovado/g, "Approved"],
    [/Recusado/g, "Rejected"],
    [/Pedido/g, "Order"],
    [/Prestador/g, "Provider"],
    [/Prestadores/g, "Providers"],
    [/Entregador/g, "Courier"],
    [/Setor/g, "Sector"],
    [/Etapa/g, "Stage"],
    [/Material/g, "Material"],
    [/Dentista/g, "Dentist"],
    [/WhatsApp/g, "WhatsApp"],
    [/Disparos/g, "Broadcasts"],
    [/Voltar/g, "Back"],
    [/aos /g, "to "],
    [/relatórios/g, "reports"],
    [/Atualizar/g, "Refresh"],
    [/Filtrar/g, "Filter"],
    [/Limpar/g, "Clear"],
    [/filtros/g, "filters"],
    [/Ano/g, "Year"],
    [/Lucro/g, "Profit"],
    [/Bruta/g, "Gross"],
    [/Líquida/g, "Net"],
    [/Líquido/g, "Net"],
    [/Indicadores/g, "Indicators"],
    [/Comparativo/g, "Comparison"],
    [/Posição/g, "Position"],
    [/Venda/g, "Sale"],
    [/Vendas/g, "Sales"],
    [/Controle/g, "Control"],
    [/Produção/g, "Production"],
    [/Tempo/g, "Time"],
    [/Auditoria/g, "Audit"],
    [/Logs/g, "Logs"],
    [/Recibos/g, "Receipts"],
    [/Emitidos/g, "Issued"],
    [/Dashboard/g, "Dashboard"],
    [/Gerencial/g, "Management"],
    [/Financeiro/g, "Financial"],
    [/Geral/g, "General"],
    [/Negativos/g, "Negative"],
    [/Concluídos/g, "Completed"],
    [/Não Concluídos/g, "Unfinished"],
    [/Curva ABC/g, "ABC curve"],
    [/Inadimplentes/g, "Delinquent"],
    [/Saldo/g, "Balance"],
    [/Extrato/g, "Statement"],
    [/Retirada/g, "Withdrawal"],
  ];
  for (const [re, rep] of map) s = s.replace(re, rep);
  return s;
}

function paraEs(pt) {
  let s = pt;
  const map = [
    [/Não foi possível/g, "No fue posible"],
    [/não foi possível/g, "no fue posible"],
    [/NOME/g, "NOMBRE"],
    [/Relatórios/g, "Informes"],
    [/RELATÓRIOS/g, "INFORMES"],
    [/Início/g, "Inicio"],
    [/INÍCIO/g, "INICIO"],
    [/Diário/g, "Diario"],
    [/DIÁRIO/g, "DIARIO"],
    [/Mensal/g, "Mensual"],
    [/MENSAL/g, "MENSUAL"],
    [/Receitas/g, "Ingresos"],
    [/RECEITAS/g, "INGRESOS"],
    [/Despesas/g, "Gastos"],
    [/DESPESAS/g, "GASTOS"],
    [/Período/g, "Período"],
    [/Situação/g, "Situación"],
    [/Previsto/g, "Previsto"],
    [/Realizado/g, "Realizado"],
    [/Imprimir/g, "Imprimir"],
    [/Exportar/g, "Exportar"],
    [/Importar/g, "Importar"],
    [/Visualizar/g, "Ver"],
    [/Editar/g, "Editar"],
    [/Ações/g, "Acciones"],
    [/Orçamento/g, "Presupuesto"],
    [/Orçamentos/g, "Presupuestos"],
    [/Estoque/g, "Stock"],
    [/Cadastros/g, "Registros"],
    [/Forma Pagamento/g, "Forma de pago"],
    [/Esta Semana/g, "Esta semana"],
    [/Este Mês/g, "Este mes"],
    [/Próximos 30 dias/g, "Próximos 30 días"],
    [/Mostrar Todos/g, "Mostrar todos"],
    [/Outro Período/g, "Otro período"],
    [/Hoje/g, "Hoy"],
    [/Todas/g, "Todas"],
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
    [/Recebimento/g, "Cobro"],
    [/Receita/g, "Ingreso"],
    [/Colaborador/g, "Colaborador"],
    [/Fornecedor/g, "Proveedor"],
    [/Laboratório/g, "Laboratorio"],
    [/Observação/g, "Observación"],
    [/Observações/g, "Observaciones"],
    [/Quantidade/g, "Cantidad"],
    [/Valor/g, "Valor"],
    [/Vencimento/g, "Vencimiento"],
    [/Data de/g, "Fecha de"],
    [/Data /g, "Fecha "],
    [/Data início/g, "Fecha inicio"],
    [/Data fim/g, "Fecha fin"],
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
    [/Novo/g, "Nuevo"],
    [/Categoria/g, "Categoría"],
    [/Custo/g, "Costo"],
    [/Movimentação/g, "Movimiento"],
    [/Histórico/g, "Historial"],
    [/Aguardando/g, "Pendiente"],
    [/Aprovado/g, "Aprobado"],
    [/Recusado/g, "Rechazado"],
    [/Pedido/g, "Pedido"],
    [/Voltar aos relatórios/g, "Volver a informes"],
    [/Conta/g, "Cuenta"],
    [/Tipo/g, "Tipo"],
    [/Total/g, "Total"],
    [/Lucro/g, "Utilidad"],
    [/Bruta/g, "Bruta"],
    [/Líquida/g, "Neta"],
    [/Líquido/g, "Neto"],
    [/Indicadores/g, "Indicadores"],
    [/Comparativo/g, "Comparativo"],
    [/Posição/g, "Posición"],
    [/Venda/g, "Venta"],
    [/Controle/g, "Control"],
    [/Produção/g, "Producción"],
    [/Tempo/g, "Tiempo"],
    [/Auditoria/g, "Auditoría"],
    [/Recibos/g, "Recibos"],
    [/Emitidos/g, "Emitidos"],
    [/Dashboard/g, "Panel"],
    [/Gerencial/g, "Gerencial"],
    [/Financeiro/g, "Financiero"],
    [/Geral/g, "General"],
    [/Saldo/g, "Saldo"],
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
