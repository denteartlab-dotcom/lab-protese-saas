import fs from "fs";

const file = "src/lib/i18n/messages-modulos.ts";
let c = fs.readFileSync(file, "utf8");

const newPtClientes = `  "cadastros.clientes.gravarAlteracoes": "Gravar Alterações",
  "cadastros.clientes.cadastrarCliente": "Cadastrar Cliente",
  "cadastros.clientes.enderecoExtra": "Endereço Extra",
  "cadastros.clientes.ajudaTabelaPreco":
    "Esta tabela será usada na ordem de serviço deste cliente. Cadastre novas tabelas em Cadastros → Tabela de Preços.",
  "cadastros.clientes.ajudaUmaTabela":
    "Só uma tabela encontrada — abra Tabela de Preços uma vez para sincronizar as demais.",
  "cadastros.clientes.ajudaLimiteSaldo":
    "Ao atingir este limite com títulos em aberto há mais de 30 dias, novas ordens de serviço para este cliente serão bloqueadas.",
  "cadastros.clientes.ajudaDiaCobranca":
    "No dia {dia} de cada mês você recebe um lembrete no sino para cobrar este cliente.",
`;

const newEnClientes = `  "cadastros.clientes.gravarAlteracoes": "Save changes",
  "cadastros.clientes.cadastrarCliente": "Register client",
  "cadastros.clientes.enderecoExtra": "Additional address",
  "cadastros.clientes.ajudaTabelaPreco":
    "This price list will be used on this client's work orders. Create new lists under Registrations → Price list.",
  "cadastros.clientes.ajudaUmaTabela":
    "Only one price list found — open Price list once to sync the others.",
  "cadastros.clientes.ajudaLimiteSaldo":
    "When this limit is reached with open invoices older than 30 days, new work orders for this client will be blocked.",
  "cadastros.clientes.ajudaDiaCobranca":
    "On day {dia} of each month you receive a bell reminder to bill this client.",
`;

const newEsClientes = `  "cadastros.clientes.gravarAlteracoes": "Guardar cambios",
  "cadastros.clientes.cadastrarCliente": "Registrar cliente",
  "cadastros.clientes.enderecoExtra": "Dirección adicional",
  "cadastros.clientes.ajudaTabelaPreco":
    "Esta tabla se usará en la orden de servicio de este cliente. Registre nuevas tablas en Registros → Tabla de precios.",
  "cadastros.clientes.ajudaUmaTabela":
    "Solo se encontró una tabla — abra Tabla de precios una vez para sincronizar las demás.",
  "cadastros.clientes.ajudaLimiteSaldo":
    "Al alcanzar este límite con títulos abiertos por más de 30 días, se bloquearán nuevas órdenes de servicio para este cliente.",
  "cadastros.clientes.ajudaDiaCobranca":
    "El día {dia} de cada mes recibe un recordatorio en la campana para cobrar a este cliente.",
`;

const newPtTabela = `  "cadastros.tabelaPrecos.duplicar": "Duplicar",
  "cadastros.tabelaPrecos.expandir": "Expandir",
  "cadastros.tabelaPrecos.recolher": "Recolher",
  "cadastros.tabelaPrecos.gerenciarCustosEstoque": "Gerenciar custos com produtos do estoque",
  "cadastros.tabelaPrecos.editarCustoItem": "Editar custo do item",
  "cadastros.tabelaPrecos.editarProdutoEstoque": "Edite o produto no estoque",
  "cadastros.tabelaPrecos.adicionarTabela": "+ Adicionar Tabela",
  "cadastros.tabelaPrecos.etapaJaAdicionada": "Etapa já adicionada ao serviço",
  "cadastros.tabelaPrecos.adicionarEtapaServico": "Adicionar etapa ao serviço",
  "cadastros.tabelaPrecos.colunaCliente": "Cliente",
  "cadastros.tabelaPrecos.placeholderValor": "0,00",
`;

const newEnTabela = `  "cadastros.tabelaPrecos.duplicar": "Duplicate",
  "cadastros.tabelaPrecos.expandir": "Expand",
  "cadastros.tabelaPrecos.recolher": "Collapse",
  "cadastros.tabelaPrecos.gerenciarCustosEstoque": "Manage costs with inventory products",
  "cadastros.tabelaPrecos.editarCustoItem": "Edit item cost",
  "cadastros.tabelaPrecos.editarProdutoEstoque": "Edit product in inventory",
  "cadastros.tabelaPrecos.adicionarTabela": "+ Add price list",
  "cadastros.tabelaPrecos.etapaJaAdicionada": "Stage already added to service",
  "cadastros.tabelaPrecos.adicionarEtapaServico": "Add stage to service",
  "cadastros.tabelaPrecos.colunaCliente": "Client",
  "cadastros.tabelaPrecos.placeholderValor": "0.00",
`;

const newEsTabela = `  "cadastros.tabelaPrecos.duplicar": "Duplicar",
  "cadastros.tabelaPrecos.expandir": "Expandir",
  "cadastros.tabelaPrecos.recolher": "Contraer",
  "cadastros.tabelaPrecos.gerenciarCustosEstoque": "Gestionar costos con productos del inventario",
  "cadastros.tabelaPrecos.editarCustoItem": "Editar costo del ítem",
  "cadastros.tabelaPrecos.editarProdutoEstoque": "Editar producto en inventario",
  "cadastros.tabelaPrecos.adicionarTabela": "+ Agregar tabla",
  "cadastros.tabelaPrecos.etapaJaAdicionada": "Etapa ya agregada al servicio",
  "cadastros.tabelaPrecos.adicionarEtapaServico": "Agregar etapa al servicio",
  "cadastros.tabelaPrecos.colunaCliente": "Cliente",
  "cadastros.tabelaPrecos.placeholderValor": "0,00",
`;

function insertAfter(anchor, block, label) {
  if (c.includes(`"${block.trim().split("\n")[0].replace(/^  /, "").replace(/:$/, "")}`)) {
    console.log(`Skip ${label} — already present`);
    return;
  }
  if (!c.includes(anchor)) {
    console.error(`Anchor not found for ${label}:`, anchor.slice(0, 80));
    process.exitCode = 1;
    return;
  }
  c = c.replace(anchor, `${anchor}\n${block}`);
  console.log(`Inserted ${label}`);
}

insertAfter(
  '  "cadastros.clientes.excluirUnicoLixeiraMensagem":\n    "Deseja enviar este cliente para a lixeira? Ele sairá da lista de ativos, mas OS e histórico permanecem.",',
  newPtClientes,
  "PT clientes"
);
insertAfter(
  '  "cadastros.clientes.excluirUnicoLixeiraMensagem":\n    "Move this client to trash? They will leave the active list, but work orders and history remain.",',
  newEnClientes,
  "EN clientes"
);
insertAfter(
  '  "cadastros.clientes.excluirUnicoLixeiraMensagem":\n    "¿Enviar este cliente a la papelera? Saldrá de la lista activa, pero las OS y el historial permanecen.",',
  newEsClientes,
  "ES clientes"
);

const tabelaAnchorPt =
  '  "cadastros.tabelaPrecos.excluirServicoConfirmacao": "Deseja realmente excluir este serviço?",';
const tabelaAnchorEn =
  '  "cadastros.tabelaPrecos.excluirServicoConfirmacao": "Do you really want to delete this service?",';
const tabelaAnchorEs =
  '  "cadastros.tabelaPrecos.excluirServicoConfirmacao": "¿Desea eliminar este servicio?",';

if (!c.includes('"cadastros.tabelaPrecos.duplicar"')) {
  insertAfter(tabelaAnchorPt, newPtTabela, "PT tabelaPrecos");
  insertAfter(tabelaAnchorEn, newEnTabela, "EN tabelaPrecos");
  insertAfter(tabelaAnchorEs, newEsTabela, "ES tabelaPrecos");
} else {
  console.log("Skip tabelaPrecos — duplicar already present");
}

fs.writeFileSync(file, c);
